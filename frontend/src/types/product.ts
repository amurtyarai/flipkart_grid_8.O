export interface Review {
  reviewId: string;
  userName: string;
  rating: number;
  title: string;
  comment: string;
  verifiedPurchase: boolean;
  date: string;
  helpfulCount: number;
  productVariant?: string;
  images?: string[];
}

export interface Offer {
  type: 'Bank Offer' | 'Partner Offer' | 'Financing' | 'Special Offer';
  title: string;
  detail: string;
}

export interface AccessoryItem {
  id: string;
  name: string;
  price: number;
  originalPrice: number;
  image: string;
  defaultSelected?: boolean;
}

export interface AISummary {
  overall: string;
  positive: string[];
  negative: string[];
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  rating: number;
  ratingCount: number;
  reviewCount: number;
  seller: string;
  sellerRating?: string;
  price: number; // MRP / Base price
  originalPrice: number;
  discount: number; // e.g. 0.35 for 35% off
  isFlipkartAssured: boolean;
  image: string;
  images: string[];
  description: string;
  offers: Offer[];
  specifications: Record<string, string>;
  reviews: Review[];
  aiSummary: AISummary;
  frequentlyBoughtTogether: AccessoryItem[];
}
