// Прайс на насіння 2026. Тут лише склад, порядок рядків і підписи.
// Ціни, ФАО, вегетація і стійкість до вовчка беруться з карток товарів (hybrids.ts),
// тому таблиця на сайті й PDF (scripts/build-price-pdf.mjs) не розходяться з картками.
import { hybrids, type Crop, type Hybrid } from './hybrids.ts';

export const PRICE_LIST_PDF = '/files/prais-agro7trade-2026.pdf';
export const PRICE_LIST_UPDATED = '19.10.2026';
export const MANUFACTURER = 'Agro7Trade';

export interface PriceListRow {
  slug: string;
  note?: string;
}

export interface PriceListTable {
  crop: Crop;
  title: string;
  // Підписи колонок цін — збігаються з label у priceTiers карток.
  tiers: string[];
  // Колонки, де в усіх рядках однакова ціна, — одна об'єднана клітинка (лише без підзаголовків груп).
  mergeTiers?: string[];
  packaging: string;
  groups: { title?: string; rows: PriceListRow[] }[];
}


export const PRICE_LIST: PriceListTable[] = [
  {
    crop: 'sonyashnyk',
    title: 'Насіння соняшника 2026',
    tiers: ['Економ', 'Стандарт', 'Екстра'],
    packaging:
      'Насіння інкрустоване (тіаметоксам, тирам та металаксил-М) та упаковане в паперові 3-шарові мішки по 1 посівній одиниці (150 тис. насінин).',
    groups: [
      {
        title: 'Гібриди під технологію Clearfield (Євролайтнінг)',
        rows: [{ slug: 'sonyashnyk-lassa' }, { slug: 'sonyashnyk-braun', note: 'Clearfield Plus' }],
      },
      {
        title: 'Гібриди під технологію Гранстар (ExpressSun)',
        rows: [{ slug: 'sonyashnyk-kaskara' }, { slug: 'sonyashnyk-luson' }],
      },
      { title: 'Гібриди під класичну технологію', rows: [{ slug: 'sonyashnyk-nabaro' }] },
    ],
  },
  {
    crop: 'kukurudza',
    title: 'Насіння кукурудзи 2026',
    tiers: ['Маса 1000 зерен до 200 г', 'Маса 1000 зерен від 200 г'],
    mergeTiers: ['Маса 1000 зерен до 200 г'],
    packaging:
      'Насіння інкрустоване (тіаметоксам, флудиоксоніл) та упаковане в паперові 3-шарові мішки по 1 посівній одиниці (80 000 насінин).',
    groups: [
      { rows: [{ slug: 'kukurudza-angora-fao-270' }, { slug: 'kukurudza-samariya-fao-300' }, { slug: 'kukurudza-sigiriya-fao-350' }] },
    ],
  },
];

export type PriceCell =
  | { kind: 'price'; value: number | undefined }
  | { kind: 'single'; value: number; colspan: number }
  | { kind: 'merged'; value: number; rowspan: number }
  | { kind: 'covered' };

export interface ResolvedRow {
  slug: string;
  name: string;
  note?: string;
  fao?: string;
  vegetation?: string;
  broomrape?: string;
  cells: PriceCell[];
}

export interface ResolvedTable extends Omit<PriceListTable, 'groups'> {
  groups: { title?: string; rows: ResolvedRow[] }[];
}

const bySlug = new Map(hybrids.map((h) => [h.slug, h]));
const spec = (h: Hybrid, re: RegExp) =>
  [...(h.specs ?? []), ...(h.resistance ?? [])].find((s) => re.test(s.label))?.value;

const hybridName = (h: Hybrid) => h.title.match(/«([^»]+)»/)?.[1] ?? h.title;
const fao = (h: Hybrid) => h.title.match(/ФАО\s*(\d+)/)?.[1];
const vegetation = (h: Hybrid) => spec(h, /Вегетаційний період/i)?.replace(/\s*днів/, '');
// У частині карток раси записані кирилицею («А–G»), приводимо до латиниці.
const broomrape = (h: Hybrid) => spec(h, /вовч/i)?.replace(/^раси\s*/, '').replace(/А/g, 'A');
const tierPrice = (h: Hybrid, tier: string) => h.priceTiers?.find((t) => t.label === tier)?.price;
const isSingle = (h: Hybrid, t: PriceListTable) =>
  h.priceTiers?.length === 1 && !t.tiers.includes(h.priceTiers[0].label);

export function resolveTable(t: PriceListTable): ResolvedTable {
  const hybridOf = (slug: string) => {
    const h = bySlug.get(slug);
    if (!h) throw new Error(`price-list: немає товару ${slug}`);
    return h;
  };
  const groups = t.groups.map((g) => ({ ...g, rows: [...g.rows] }));
  // Кукурудза — за зростанням ФАО (лише в таблицях без підзаголовків груп).
  if (t.crop === 'kukurudza' && groups.every((g) => !g.title)) {
    for (const g of groups) g.rows.sort((a, b) => Number(fao(hybridOf(a.slug))) - Number(fao(hybridOf(b.slug))));
  }
  const all = groups.flatMap((g) => g.rows).map((r) => hybridOf(r.slug));
  const priceFor = (h: Hybrid, tier: string) => (isSingle(h, t) ? h.priceTiers![0].price : tierPrice(h, tier));

  const merged = new Map<string, number>();
  if (groups.every((g) => !g.title)) {
    for (const tier of t.mergeTiers ?? []) {
      const values = all.map((h) => priceFor(h, tier));
      if (values[0] !== undefined && values.every((v) => v === values[0])) merged.set(tier, values[0]);
    }
  }

  let index = 0;
  return {
    ...t,
    groups: groups.map((g) => ({
      title: g.title,
      rows: g.rows.map((r) => {
        const h = all[index];
        const first = index === 0;
        index++;
        const cells: PriceCell[] =
          isSingle(h, t) && merged.size === 0
            ? [{ kind: 'single', value: h.priceTiers![0].price, colspan: t.tiers.length }]
            : t.tiers.map((tier): PriceCell =>
                merged.has(tier)
                  ? first ? { kind: 'merged', value: merged.get(tier)!, rowspan: all.length } : { kind: 'covered' }
                  : { kind: 'price', value: tierPrice(h, tier) },
              );
        return {
          slug: h.slug,
          name: hybridName(h),
          note: r.note,
          fao: fao(h),
          vegetation: vegetation(h),
          broomrape: broomrape(h),
          cells,
        };
      }),
    })),
  };
}

export const RESOLVED_PRICE_LIST = PRICE_LIST.map(resolveTable);

export const findPriceTable = (slug: string) =>
  RESOLVED_PRICE_LIST.find((t) => t.groups.some((g) => g.rows.some((r) => r.slug === slug)));

export const formatPrice = (n: number | undefined) => (n && n > 0 ? n.toLocaleString('uk-UA') : '—');
