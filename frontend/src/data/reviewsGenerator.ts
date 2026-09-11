import type { Review } from '../types/product';

const FIRST_NAMES = [
  "Aarav", "Ananya", "Rohan", "Priya", "Vikram", "Sneha", "Karthik", "Neha", 
  "Siddharth", "Divya", "Devang", "Komal", "Varun", "Akash", "Manish", "Rajesh", 
  "Deepak", "Pooja", "Amit", "Kavya", "Rahul", "Shweta", "Aditya", "Ishita", 
  "Gaurav", "Meera", "Nikhil", "Simran", "Tushar", "Preeti", "Harsh", "Tanvi",
  "Yash", "Ritu", "Alok", "Nidhi", "Suresh", "Bhavna", "Kunal", "Rhea", "Tarun"
];

const LAST_NAMES = [
  "Sharma", "Gupta", "Varma", "Nair", "Patel", "Mehta", "Roy", "Reddy", 
  "Tiwari", "Seth", "Bajaj", "Nayak", "Kapoor", "Joshi", "Deshmukh", "Singhania", 
  "Bhatia", "Chawla", "Dutta", "Kulkarni", "Malhotra", "Verma", "Rao", "Sinha"
];

const POSITIVE_TITLES = [
  "Absolutely worth every rupee!",
  "Exceeded my expectations",
  "Top quality product!",
  "Super fast Flipkart delivery & genuine item",
  "Must buy in this price segment",
  "Impressive build and performance",
  "Very happy with this purchase",
  "Outstanding quality & packaging",
  "Value for money deal!",
  "Works like a charm",
  "Highly recommended for daily use",
  "Five stars without a doubt!"
];

const NEUTRAL_TITLES = [
  "Good product overall",
  "Decent performance for the price",
  "Works fine, minor drawbacks",
  "Satisfactory purchase",
  "Meets basic requirements",
  "Good but delivery took time"
];

const NEGATIVE_TITLES = [
  "Outer packaging was damaged",
  "Average experience",
  "Could have been better",
  "Slight defect in initial unit",
  "Not fully satisfied with battery/finish"
];

const REVIEW_IMAGES_POOL = [
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1609592424109-dd9892f1b177?w=400&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=400&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=400&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1593784991095-a205069470b6?w=400&auto=format&fit=crop&q=80"
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function generate45Reviews(productId: string, productName: string, brand: string, category: string, targetRating: number): Review[] {
  const reviews: Review[] = [];
  const totalCount = 42; // Generates exactly 42 reviews per product

  for (let i = 0; i < totalCount; i++) {
    // Determine rating distribution around targetRating
    const rand = Math.random();
    let rating = 5;
    if (targetRating >= 4.3) {
      if (rand < 0.60) rating = 5;
      else if (rand < 0.82) rating = 4;
      else if (rand < 0.92) rating = 3;
      else if (rand < 0.97) rating = 2;
      else rating = 1;
    } else if (targetRating >= 4.0) {
      if (rand < 0.45) rating = 5;
      else if (rand < 0.75) rating = 4;
      else if (rand < 0.88) rating = 3;
      else if (rand < 0.95) rating = 2;
      else rating = 1;
    } else {
      if (rand < 0.30) rating = 5;
      else if (rand < 0.60) rating = 4;
      else if (rand < 0.80) rating = 3;
      else if (rand < 0.92) rating = 2;
      else rating = 1;
    }

    const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lastName = LAST_NAMES[(i * 3 + 1) % LAST_NAMES.length];
    const userName = `${firstName} ${lastName}`;

    let title = "";
    let comment = "";

    if (rating >= 4) {
      title = POSITIVE_TITLES[i % POSITIVE_TITLES.length];
      comment = `I've been using this ${productName} (${brand} ${nameCategory(category)}) for over ${((i % 4) + 1)} weeks. The overall experience has been fantastic. Performance is smooth, build quality feels solid, and it delivers exactly as advertised. Flipkart Assured delivery was fast!`;
    } else if (rating === 3) {
      title = NEUTRAL_TITLES[i % NEUTRAL_TITLES.length];
      comment = `The ${productName} works fine for basic needs, but has minor shortcomings. The setup took some time and the outer box had slight wear. However, at this price point, it gets the job done.`;
    } else {
      title = NEGATIVE_TITLES[i % NEGATIVE_TITLES.length];
      comment = `Faced minor issues with courier delivery timelines for ${productName} and the outer packaging was slightly crushed during transit. The product itself functions, but expected better quality control.`;
    }

    const day = Math.floor(Math.random() * 28) + 1;
    const month = MONTHS[i % 12];
    const year = 2025;
    const date = `${day < 10 ? '0' + day : day} ${month} ${year}`;

    const helpfulCount = rating === 5 ? Math.floor(Math.random() * 85) + 12 : Math.floor(Math.random() * 25) + 2;
    const verifiedPurchase = Math.random() < 0.92;
    const hasImages = i % 7 === 0;

    reviews.push({
      reviewId: `rev-${productId}-${i + 1}`,
      userName,
      rating,
      title,
      comment,
      verifiedPurchase,
      date,
      helpfulCount,
      productVariant: `Standard / ${brand} Authentic`,
      images: hasImages ? [REVIEW_IMAGES_POOL[i % REVIEW_IMAGES_POOL.length]] : undefined
    });
  }

  return reviews;
}

function nameCategory(cat: string): string {
  if (cat.includes("Electronics") || cat.includes("Smartphones")) return "device";
  if (cat.includes("Fashion")) return "outfit";
  if (cat.includes("Beauty")) return "item";
  if (cat.includes("Home")) return "appliance";
  return "product";
}
