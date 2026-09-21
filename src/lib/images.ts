import type { ImageMetadata } from 'astro';
import logo from '../assets/images/logo.png';
import cornImg from '../assets/images/corn-pack.png';
import sunflowerImg from '../assets/images/sunflower-pack.png';
import cornCategoryImg from '../assets/images/corn-category.png';
import sunflowerCategoryImg from '../assets/images/sunflower-category.png';
import fieldAngora from '../assets/images/field-angora.jpg';
import fieldKaskara from '../assets/images/field-kaskara.jpg';
import fieldSigiriya from '../assets/images/field-sigiriya.jpg';
import meshkiAgro7 from '../assets/images/meshki-agro7.jpg';
import pole1 from '../assets/images/pole1.jpg';
import pole2 from '../assets/images/pole2.jpg';
import pole3 from '../assets/images/pole3.jpg';
import pole4 from '../assets/images/pole4.jpg';
import pole5 from '../assets/images/pole5.jpg';

const fieldPhotosBySlug: Record<string, ImageMetadata> = {
  'kukurudza-angora-fao-270': fieldAngora,
  'kukurudza-sigiriya-fao-350': fieldSigiriya,
  'sonyashnyk-kaskara': fieldKaskara,
};

/** Real field photo for a hybrid, when we have one — used as a secondary/additional photo, never as the main product image. */
export function getFieldPhoto(slug: string): ImageMetadata | undefined {
  return fieldPhotosBySlug[slug];
}

export {
  logo,
  cornImg,
  sunflowerImg,
  cornCategoryImg,
  sunflowerCategoryImg,
  fieldAngora,
  fieldKaskara,
  fieldSigiriya,
  meshkiAgro7,
  pole1,
  pole2,
  pole3,
  pole4,
  pole5,
};
