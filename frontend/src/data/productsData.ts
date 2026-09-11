import type { Product } from '../types/product';
import { generate45Reviews } from './reviewsGenerator';

export const INITIAL_PRODUCTS: Product[] = [
  // 1. SMARTPHONES & FLAGSHIPS
  {
    id: "prod-11",
    name: "Apple iPhone 15 Pro (128GB - Natural Titanium)",
    brand: "Apple",
    category: "Smartphones",
    rating: 4.7,
    ratingCount: 8450,
    reviewCount: 1820,
    seller: "SuperComNet",
    sellerRating: "4.9 / 5",
    price: 134900,
    originalPrice: 134900,
    discount: 0.08,
    isFlipkartAssured: true,
    image: "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=800&auto=format&fit=crop&q=80"
    ],
    description: "Forged in titanium featuring the groundbreaking A17 Pro chip, customizable Action button, 48MP Pro camera system with 3x Telephoto lens, and USB-C with USB 3 speeds.",
    offers: [
      { type: "Bank Offer", title: "Flat ₹5,000 Instant Cashback", detail: "Instant cashback on HDFC Bank Credit Cards" },
      { type: "Partner Offer", title: "No Cost EMI up to 24 Months", detail: "Zero interest EMI on major credit cards" }
    ],
    specifications: {
      "Display": "6.1-inch Super Retina XDR OLED (120Hz ProMotion)",
      "Processor": "A17 Pro Chip (3nm)",
      "Camera": "48MP Main + 12MP Ultra Wide + 12MP 3x Telephoto",
      "Battery": "Up to 23 Hours Video Playback",
      "Build": "Aerospace-grade Titanium Frame",
      "Warranty": "1 Year Apple Brand Warranty"
    },
    aiSummary: {
      overall: "Customers praise the lightweight Grade 5 titanium chassis, ProMotion 120Hz display, and A17 Pro gaming performance. Battery easily lasts full day.",
      positive: ["Ultra-lightweight titanium body", "Stunning 48MP camera quality", "Blazing fast A17 Pro chip"],
      negative: ["Charging adapter sold separately"]
    },
    frequentlyBoughtTogether: [
      { id: "acc-ip-1", name: "Apple 20W USB-C Power Adapter", price: 1699, originalPrice: 1900, image: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=400&auto=format&fit=crop&q=80", defaultSelected: true },
      { id: "acc-ip-2", name: "MagSafe Transparent Armor Case", price: 999, originalPrice: 2499, image: "https://images.unsplash.com/photo-1609592424109-dd9892f1b177?w=400&auto=format&fit=crop&q=80", defaultSelected: true }
    ],
    reviews: generate45Reviews("prod-11", "Apple iPhone 15 Pro", "Apple", "Smartphones", 4.7)
  },

  {
    id: "prod-12",
    name: "Samsung Galaxy S24 Ultra 5G (Titanium Gray, 256GB)",
    brand: "Samsung",
    category: "Smartphones",
    rating: 4.6,
    ratingCount: 6200,
    reviewCount: 1410,
    seller: "OmniTechRetail",
    sellerRating: "4.8 / 5",
    price: 129999,
    originalPrice: 129999,
    discount: 0.10,
    isFlipkartAssured: true,
    image: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=800&auto=format&fit=crop&q=80"
    ],
    description: "Welcome to Galaxy AI. Capture 200MP detail with quad telephoto cameras, integrated S Pen, Snapdragon 8 Gen 3 for Galaxy, and anti-reflective Corning Gorilla Armor display.",
    offers: [
      { type: "Bank Offer", title: "Flat ₹10,000 Exchange Bonus", detail: "Additional exchange bonus on old smartphones" }
    ],
    specifications: {
      "Display": "6.8-inch QHD+ Dynamic AMOLED 2X (2600 nits Peak)",
      "Processor": "Snapdragon 8 Gen 3 for Galaxy",
      "Camera": "200MP + 50MP 5x + 10MP 3x + 12MP Ultra Wide",
      "S Pen": "Embedded Low-Latency Stylus",
      "Warranty": "1 Year Samsung India Warranty"
    },
    aiSummary: {
      overall: "Acclaimed for Galaxy AI translation tools, 100x Space Zoom camera capabilities, and bright anti-reflective screen.",
      positive: ["200MP ultra camera detail", "Integrated S Pen functionality", "Gorilla Armor glare reduction"],
      negative: ["Large form factor for one-handed use"]
    },
    frequentlyBoughtTogether: [],
    reviews: generate45Reviews("prod-12", "Samsung Galaxy S24 Ultra", "Samsung", "Smartphones", 4.6)
  },

  {
    id: "prod-13",
    name: "OnePlus 12 5G (Silky Black, 16GB RAM + 512GB)",
    brand: "OnePlus",
    category: "Smartphones",
    rating: 4.5,
    ratingCount: 5100,
    reviewCount: 980,
    seller: "RetailNet",
    sellerRating: "4.7 / 5",
    price: 69999,
    originalPrice: 69999,
    discount: 0.07,
    isFlipkartAssured: true,
    image: "https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=800&auto=format&fit=crop&q=80"
    ],
    description: "Smooth Beyond Belief. Snapdragon 8 Gen 3, 4th Gen Hasselblad Camera for Mobile, 5400mAh battery with 100W SUPERVOOC and 50W AIRVOOC charging.",
    offers: [
      { type: "Bank Offer", title: "Instant ₹4,000 Off", detail: "Instant discount on ICICI & OneCard Cards" }
    ],
    specifications: {
      "Display": "6.82-inch 2K 120Hz ProXDR AMOLED (4500 nits)",
      "Processor": "Snapdragon 8 Gen 3",
      "Battery & Charging": "5400 mAh with 100W Wired + 50W Wireless",
      "Camera": "50MP Sony LYT-808 + 64MP Periscope + 48MP Wide",
      "Warranty": "1 Year OnePlus Warranty"
    },
    aiSummary: {
      overall: "Highly praised for 100W charging (0-100% in 26 mins), 4500 nits bright 2K display, and Hasselblad portrait photography.",
      positive: ["Blazing 100W superfast charging", "Hasselblad color science", "Dual Cryo-velocity VC cooling"],
      negative: ["Curved screen glass requires specialized screen guard"]
    },
    frequentlyBoughtTogether: [],
    reviews: generate45Reviews("prod-13", "OnePlus 12 5G", "OnePlus", "Smartphones", 4.5)
  },

  // 2. LAPTOPS & COMPUTING
  {
    id: "prod-14",
    name: "Apple MacBook Air M3 (15.3-inch, 16GB, 512GB SSD)",
    brand: "Apple",
    category: "Laptops",
    rating: 4.8,
    ratingCount: 3900,
    reviewCount: 760,
    seller: "SuperComNet",
    sellerRating: "4.9 / 5",
    price: 154900,
    originalPrice: 154900,
    discount: 0.06,
    isFlipkartAssured: true,
    image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&auto=format&fit=crop&q=80"
    ],
    description: "Lean. Mean. M3 machine. Liquid Retina display, fanless silent design, up to 18 hours battery life, 1080p FaceTime HD camera, and MagSafe 3 charging.",
    offers: [
      { type: "Bank Offer", title: "Flat ₹10,000 Off", detail: "Instant discount on HDFC Bank Cards" }
    ],
    specifications: {
      "Display": "15.3-inch Liquid Retina (2880 x 1864, 500 nits)",
      "Processor": "Apple M3 chip (8-core CPU, 10-core GPU)",
      "Memory & Storage": "16GB Unified Memory / 512GB SSD",
      "Battery Life": "Up to 18 Hours",
      "Weight": "1.51 kg",
      "Warranty": "1 Year Apple Warranty"
    },
    aiSummary: {
      overall: "Incredible 18-hour real world battery life, silent fanless operation, and immersive 6-speaker audio system.",
      positive: ["All-day 18-hour battery", "Silent zero-fan design", "Stunning 15.3-inch Retina screen"],
      negative: ["Midnight color attracts finger prints"]
    },
    frequentlyBoughtTogether: [],
    reviews: generate45Reviews("prod-14", "MacBook Air M3", "Apple", "Laptops", 4.8)
  },

  {
    id: "prod-8c",
    name: "ASUS ROG Strix G16 Gaming Laptop (16-inch, RTX 4070)",
    brand: "ASUS",
    category: "Laptops",
    rating: 4.6,
    ratingCount: 1890,
    reviewCount: 410,
    seller: "GamerNet",
    sellerRating: "4.7 / 5",
    price: 179990,
    originalPrice: 179990,
    discount: 0.15,
    isFlipkartAssured: true,
    image: "https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=800&auto=format&fit=crop&q=80"
    ],
    description: "Dominate the battlefield. 13th Gen Intel Core i9-13980HX, NVIDIA GeForce RTX 4070 8GB, ROG Intelligent Cooling with Conductonaut Extreme Liquid Metal.",
    offers: [
      { type: "Bank Offer", title: "Flat ₹7,500 Off", detail: "Instant discount on Axis Bank Credit Cards" }
    ],
    specifications: {
      "Display": "16-inch QHD+ 240Hz/3ms ROG Nebula Display",
      "Processor": "Intel Core i9-13980HX (24 cores)",
      "GPU": "NVIDIA GeForce RTX 4070 8GB GDDR6 (140W TGP)",
      "RAM & Storage": "32GB DDR5 4800MHz / 1TB PCIe 4.0 SSD",
      "Warranty": "1 Year ASUS Onsite Warranty"
    },
    aiSummary: {
      overall: "High FPS beast for AAA gaming and 4K video rendering. 240Hz Nebula screen is silky smooth.",
      positive: ["Extremely high FPS on RTX 4070", "240Hz QHD+ Nebula panel", "Tri-Fan liquid metal cooling"],
      negative: ["Power brick adapter is heavy"]
    },
    frequentlyBoughtTogether: [],
    reviews: generate45Reviews("prod-8c", "ASUS ROG Strix G16", "ASUS", "Laptops", 4.6)
  },

  // 3. AUDIO & WEARABLES
  {
    id: "prod-2e",
    name: "Sony WH-1000XM5 Noise Canceling Headphones",
    brand: "Sony",
    category: "Electronics",
    rating: 4.7,
    ratingCount: 9200,
    reviewCount: 2150,
    seller: "SonyAuthorised",
    sellerRating: "4.9 / 5",
    price: 34990,
    originalPrice: 34990,
    discount: 0.14,
    isFlipkartAssured: true,
    image: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800&auto=format&fit=crop&q=80"
    ],
    description: "Industry-leading noise canceling with two processors and 8 microphones. Precise Voice Pickup technology, 30-hour battery life, and ultra-comfortable lightweight design.",
    offers: [
      { type: "Bank Offer", title: "Flat ₹3,000 Off", detail: "Instant discount on All Bank Cards" }
    ],
    specifications: {
      "Noise Cancellation": "Auto NC Optimizer with V1 & QN1 Processors",
      "Battery Life": "30 Hours (ANC On)",
      "Quick Charge": "3 mins = 3 hours playback",
      "Audio Codec": "LDAC High-Res Audio Wireless",
      "Warranty": "1 Year Sony India Warranty"
    },
    aiSummary: {
      overall: "World-class active noise cancellation that silences flight cabin noise and office chatter. Supreme call microphone clarity.",
      positive: ["Unmatched ANC performance", "Hi-Res LDAC sound stage", "Ultra light memory foam earcups"],
      negative: ["Case does not fold completely flat"]
    },
    frequentlyBoughtTogether: [],
    reviews: generate45Reviews("prod-2e", "Sony WH-1000XM5", "Sony", "Electronics", 4.7)
  },

  {
    id: "prod-2f",
    name: "Apple AirPods Pro (2nd Gen) USB-C",
    brand: "Apple",
    category: "Electronics",
    rating: 4.8,
    ratingCount: 11400,
    reviewCount: 3100,
    seller: "SuperComNet",
    sellerRating: "4.9 / 5",
    price: 24900,
    originalPrice: 24900,
    discount: 0.10,
    isFlipkartAssured: true,
    image: "https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=800&auto=format&fit=crop&q=80"
    ],
    description: "Re-architected H2 chip powers up to 2x more Active Noise Cancellation, Adaptive Audio, Transparency mode, and Personalized Spatial Audio with dynamic head tracking.",
    offers: [
      { type: "Bank Offer", title: "Flat ₹2,000 Off", detail: "Instant cashback on HDFC Bank Credit Cards" }
    ],
    specifications: {
      "Chip": "Apple H2 Headphone Chip",
      "Noise Control": "2x Active Noise Cancellation + Adaptive Audio",
      "Charging Case": "MagSafe (USB-C) with Speaker & Lanyard Loop",
      "Water Resistance": "IP54 Dust, Sweat, and Water Resistant",
      "Warranty": "1 Year Apple Warranty"
    },
    aiSummary: {
      overall: "Flawless integration with Apple ecosystem, transformative Active Noise Control, and spatial audio precision.",
      positive: ["2x stronger noise cancellation", "Adaptive Transparency mode", "Precise Find My speaker case"],
      negative: ["Silicone tips require periodic cleaning"]
    },
    frequentlyBoughtTogether: [],
    reviews: generate45Reviews("prod-2f", "Apple AirPods Pro 2", "Apple", "Electronics", 4.8)
  },

  {
    id: "prod-2g",
    name: "Noise ColorFit Pro 4 Max Smartwatch",
    brand: "Noise",
    category: "Electronics",
    rating: 4.2,
    ratingCount: 4890,
    reviewCount: 890,
    seller: "OmniTechRetail",
    sellerRating: "4.4 / 5",
    price: 5999,
    originalPrice: 5999,
    discount: 0.60,
    isFlipkartAssured: true,
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80"
    ],
    description: "1.80-inch TFT display, Tru Sync Bluetooth Calling, built-in Alexa voice assistant, 100+ sports modes, 150+ watch faces, and 7-day battery backup.",
    offers: [
      { type: "Bank Offer", title: "Extra 5% Off", detail: "5% cashback on Flipkart Axis Bank Card" }
    ],
    specifications: {
      "Display": "1.80-inch TFT LCD (240 x 286 px)",
      "Calling": "Tru Sync Bluetooth Calling",
      "Voice Assistant": "Built-in Amazon Alexa",
      "Health Sensors": "SpO2, 24x7 Heart Rate, Stress, Sleep",
      "Warranty": "1 Year Noise Warranty"
    },
    aiSummary: {
      overall: "Great budget smartwatch with loud Bluetooth calling speaker, Alexa voice integration, and accurate step tracking.",
      positive: ["Loud Bluetooth calling", "Built-in Alexa support", "7-day battery life"],
      negative: ["App sync takes 5-10 seconds on boot"]
    },
    frequentlyBoughtTogether: [],
    reviews: generate45Reviews("prod-2g", "Noise ColorFit Pro 4", "Noise", "Electronics", 4.2)
  },

  // 4. EXISTING CATALOG ENRICHED WITH 42 REVIEWS EACH
  {
    id: "prod-1",
    name: "Flipkart SmartBuy 20000mAh Power Bank",
    brand: "Flipkart SmartBuy",
    category: "Electronics",
    rating: 4.3,
    ratingCount: 1840,
    reviewCount: 412,
    seller: "SuperComNet",
    sellerRating: "4.4 / 5",
    price: 2899,
    originalPrice: 2899,
    discount: 0.35,
    isFlipkartAssured: true,
    image: "https://images.unsplash.com/photo-1609592424109-dd9892f1b177?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1609592424109-dd9892f1b177?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=800&auto=format&fit=crop&q=80"
    ],
    description: "Fast charging 20000mAh lithium polymer power bank with dual USB outputs, 22.5W Power Delivery, and Type-C input support.",
    offers: [
      { type: "Bank Offer", title: "5% Unlimited Cashback", detail: "5% Cashback on Flipkart Axis Bank Credit Card T&C" }
    ],
    specifications: {
      "Model Name": "SmartBuy PD 20000",
      "Capacity": "20000 mAh",
      "Output Power": "22.5 W Fast Charge",
      "Warranty": "1 Year Domestic Brand Warranty"
    },
    aiSummary: {
      overall: "Customers highly appreciate the fast charging speed, massive 20,000mAh battery backup, and durable build quality.",
      positive: ["22.5W Fast Power Delivery", "Durable build finish", "Charges phone up to 4 times"],
      negative: ["Slightly heavy in pocket"]
    },
    frequentlyBoughtTogether: [],
    reviews: generate45Reviews("prod-1", "Flipkart Power Bank 20000mAh", "Flipkart SmartBuy", "Electronics", 4.3)
  },

  {
    id: "prod-2",
    name: "boAt Rockerz 450 Bluetooth Headphone",
    brand: "boAt",
    category: "Electronics",
    rating: 4.1,
    ratingCount: 1243,
    reviewCount: 342,
    seller: "RetailNet",
    sellerRating: "4.5 / 5",
    price: 3990,
    originalPrice: 3990,
    discount: 0.50,
    isFlipkartAssured: true,
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80"
    ],
    description: "Wireless Bluetooth headphones featuring 40mm dynamic drivers, punchy bass, plush ear cushions, and up to 15 hours playback.",
    offers: [
      { type: "Bank Offer", title: "10% Instant Discount", detail: "10% off on HDFC Bank Credit Card EMI Transactions" }
    ],
    specifications: {
      "Model Name": "Rockerz 450",
      "Headphone Type": "On-Ear Wireless",
      "Driver Size": "40 mm Dynamic",
      "Warranty": "1 Year boAt Brand Warranty"
    },
    aiSummary: {
      overall: "Customers highly appreciate the powerful bass response, sleek matte finish, long battery backup, and cushion comfort.",
      positive: ["Punchy Super Extra Bass", "Solid 15-hour playback", "Fast ASAP charging"],
      negative: ["Headband fits tight initially"]
    },
    frequentlyBoughtTogether: [],
    reviews: generate45Reviews("prod-2", "boAt Rockerz 450", "boAt", "Electronics", 4.1)
  },

  {
    id: "prod-2b",
    name: "boAt Rockerz 550 Over-Ear Headphone",
    brand: "boAt",
    category: "Electronics",
    rating: 4.3,
    ratingCount: 2150,
    reviewCount: 512,
    seller: "RetailNet",
    sellerRating: "4.5 / 5",
    price: 4990,
    originalPrice: 4990,
    discount: 0.55,
    isFlipkartAssured: true,
    image: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800&auto=format&fit=crop&q=80"
    ],
    description: "Over-ear wireless headphones with 50mm dynamic drivers, physical noise isolation, up to 20 hours battery life, and ergonomic earcups.",
    offers: [
      { type: "Bank Offer", title: "10% Instant Discount", detail: "10% off on ICICI Bank Cards" }
    ],
    specifications: {
      "Model Name": "Rockerz 550",
      "Driver Size": "50 mm Dynamic",
      "Warranty": "1 Year Brand Warranty"
    },
    aiSummary: {
      overall: "Users love the 50mm drivers and soft over-ear cushions for immersive gaming and music.",
      positive: ["50mm bass drivers", "20hr continuous playtime"],
      negative: ["Takes 2.5 hours to full charge"]
    },
    frequentlyBoughtTogether: [],
    reviews: generate45Reviews("prod-2b", "boAt Rockerz 550", "boAt", "Electronics", 4.3)
  },

  {
    id: "prod-2c",
    name: "JBL Tune 760NC Wireless Headphones",
    brand: "JBL",
    category: "Electronics",
    rating: 4.4,
    ratingCount: 3410,
    reviewCount: 680,
    seller: "OmniTechRetail",
    sellerRating: "4.6 / 5",
    price: 7999,
    originalPrice: 7999,
    discount: 0.35,
    isFlipkartAssured: true,
    image: "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=800&auto=format&fit=crop&q=80"
    ],
    description: "Active Noise Cancelling wireless headphones with Pure Bass Sound, 35 hours battery life with ANC on, multipoint Bluetooth connection.",
    offers: [],
    specifications: {
      "Model Name": "Tune 760NC",
      "Battery Life": "35 Hours",
      "Warranty": "1 Year JBL Warranty"
    },
    aiSummary: {
      overall: "Customers praise JBL Pure Bass sound, active noise cancellation performance, and lightweight foldable design.",
      positive: ["Active Noise Cancellation", "35 Hours battery backup"],
      negative: ["Mic quality is average outdoors"]
    },
    frequentlyBoughtTogether: [],
    reviews: generate45Reviews("prod-2c", "JBL Tune 760NC", "JBL", "Electronics", 4.4)
  },

  {
    id: "prod-2d",
    name: "Sony WH-CH520 Wireless Headset",
    brand: "Sony",
    category: "Electronics",
    rating: 4.5,
    ratingCount: 4200,
    reviewCount: 890,
    seller: "SonyAuthorised",
    sellerRating: "4.8 / 5",
    price: 5990,
    originalPrice: 5990,
    discount: 0.25,
    isFlipkartAssured: true,
    image: "https://images.unsplash.com/photo-1484704849700-f032a568e944?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1484704849700-f032a568e944?w=800&auto=format&fit=crop&q=80"
    ],
    description: "Wireless headphones with up to 50 hours battery life, DSEE sound enhancement, crystal clear hands-free call quality.",
    offers: [],
    specifications: {
      "Model Name": "WH-CH520",
      "Battery Life": "50 Hours",
      "Warranty": "1 Year Sony Warranty"
    },
    aiSummary: {
      overall: "Unmatched 50-hour battery life and supreme voice call clarity make it the top choice for remote work and travel.",
      positive: ["50-hour battery monster", "DSEE audio upscale"],
      negative: ["Non-collapsible headband"]
    },
    frequentlyBoughtTogether: [],
    reviews: generate45Reviews("prod-2d", "Sony WH-CH520", "Sony", "Electronics", 4.5)
  },

  {
    id: "prod-3",
    name: "Mi Smart TV 4A 32-inch LED TV",
    brand: "Mi",
    category: "Home Appliances",
    rating: 4.4,
    ratingCount: 5820,
    reviewCount: 1120,
    seller: "OmniTechRetail",
    sellerRating: "4.6 / 5",
    price: 19999,
    originalPrice: 19999,
    discount: 0.20,
    isFlipkartAssured: true,
    image: "https://images.unsplash.com/photo-1593784991095-a205069470b6?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1593784991095-a205069470b6?w=800&auto=format&fit=crop&q=80"
    ],
    description: "HD Ready Android smart TV featuring 20W Dolby Audio stereo speakers, PatchWall with 30+ OTT content partners.",
    offers: [],
    specifications: {
      "Display Size": "32 Inches",
      "Sound": "20 W Dolby Audio",
      "Warranty": "1 Year Warranty"
    },
    aiSummary: {
      overall: "Customers love the vibrant LED panel, easy Android UI, and crisp 20W Dolby speakers.",
      positive: ["Vibrant HD display colors", "Dolby Audio sound clarity"],
      negative: ["Remote lacks dedicated mute button"]
    },
    frequentlyBoughtTogether: [],
    reviews: generate45Reviews("prod-3", "Mi Smart TV 4A 32", "Mi", "Home Appliances", 4.4)
  },

  {
    id: "prod-3b",
    name: "Samsung 43-inch Crystal 4K UHD Smart TV",
    brand: "Samsung",
    category: "Home Appliances",
    rating: 4.6,
    ratingCount: 7800,
    reviewCount: 1540,
    seller: "OmniTechRetail",
    sellerRating: "4.8 / 5",
    price: 44900,
    originalPrice: 44900,
    discount: 0.35,
    isFlipkartAssured: true,
    image: "https://images.unsplash.com/photo-1577979749830-f1d742b96791?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1577979749830-f1d742b96791?w=800&auto=format&fit=crop&q=80"
    ],
    description: "Crystal Processor 4K, PurColor realism, Q-Symphony sound alignment, Tizen OS smart hub, and Motion Xcelerator.",
    offers: [],
    specifications: {
      "Display Size": "43 Inches (108 cm)",
      "Resolution": "4K Ultra HD (3840 x 2160)",
      "Warranty": "2 Years Comprehensive Samsung Warranty"
    },
    aiSummary: {
      overall: "Exceptional 4K Crystal Processor picture depth, sleek bezel-less design, and Q-Symphony sound integration.",
      positive: ["Vivid 4K HDR PurColor", "Bezel-less AirSlim design"],
      negative: ["Tizen store app selection is selective"]
    },
    frequentlyBoughtTogether: [],
    reviews: generate45Reviews("prod-3b", "Samsung 43-inch Crystal 4K", "Samsung", "Home Appliances", 4.6)
  },

  {
    id: "prod-4",
    name: "Premium Cotton Casual Check Shirt",
    brand: "Roadster",
    category: "Fashion",
    rating: 3.9,
    ratingCount: 890,
    reviewCount: 195,
    seller: "StyleNet",
    sellerRating: "4.1 / 5",
    price: 2199,
    originalPrice: 2199,
    discount: 0.40,
    isFlipkartAssured: false,
    image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800&auto=format&fit=crop&q=80"
    ],
    description: "100% premium breathable cotton slim fit casual check shirt featuring curved hemline and double chest patch pockets.",
    offers: [],
    specifications: {
      "Fabric": "100% Cotton",
      "Fit": "Slim Fit"
    },
    aiSummary: {
      overall: "Customers love the soft 100% cotton fabric feel and stylish checkered pattern.",
      positive: ["Soft breathable cotton", "Trendy colors and fit"],
      negative: ["Shrinks slightly after hot wash"]
    },
    frequentlyBoughtTogether: [],
    reviews: generate45Reviews("prod-4", "Roadster Check Shirt", "Roadster", "Fashion", 3.9)
  },

  {
    id: "prod-4b",
    name: "Levi's 511 Slim Fit Stretchable Jeans",
    brand: "Levi's",
    category: "Fashion",
    rating: 4.5,
    ratingCount: 6100,
    reviewCount: 1200,
    seller: "StyleNet",
    sellerRating: "4.7 / 5",
    price: 3999,
    originalPrice: 3999,
    discount: 0.40,
    isFlipkartAssured: true,
    image: "https://images.unsplash.com/photo-1542272604-780c96856592?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1542272604-780c96856592?w=800&auto=format&fit=crop&q=80"
    ],
    description: "Classic Levi's 511 slim fit denim featuring elastane stretch comfort, iconic red tab back pocket, and durable wash.",
    offers: [],
    specifications: {
      "Fabric": "98% Cotton, 2% Elastane",
      "Fit": "511 Slim Fit"
    },
    aiSummary: {
      overall: "Timeless Levi's quality, flexible stretch denim comfort, and perfect slim silhouette.",
      positive: ["Iconic Levi's build", "Comfortable stretch denim"],
      negative: ["Length may require hem tailoring"]
    },
    frequentlyBoughtTogether: [],
    reviews: generate45Reviews("prod-4b", "Levi's 511 Slim Fit Jeans", "Levi's", "Fashion", 4.5)
  },

  {
    id: "prod-4c",
    name: "Nike Air Max 270 Running Shoes",
    brand: "Nike",
    category: "Fashion",
    rating: 4.7,
    ratingCount: 7900,
    reviewCount: 1650,
    seller: "NikeIndia",
    sellerRating: "4.9 / 5",
    price: 13995,
    originalPrice: 13995,
    discount: 0.20,
    isFlipkartAssured: true,
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=80"
    ],
    description: "Boasting Nike's biggest heel Max Air unit yet, delivering a super-soft ride that feels as impossible as it looks.",
    offers: [],
    specifications: {
      "Sole": "270 Max Air Heel Unit",
      "Upper": "Engineered Knit Fabric"
    },
    aiSummary: {
      overall: "Sensational heel cushioning, stylish futuristic aesthetic, and superior bounce for athletic training.",
      positive: ["Massive Air heel cushioning", "Eye-catching athletic design"],
      negative: ["Fits snug, recommend half size up"]
    },
    frequentlyBoughtTogether: [],
    reviews: generate45Reviews("prod-4c", "Nike Air Max 270", "Nike", "Fashion", 4.7)
  },

  {
    id: "prod-5",
    name: "L'Oreal Paris Extraordinary Hair Oil",
    brand: "L'Oreal Paris",
    category: "Beauty & Personal Care",
    rating: 4.5,
    ratingCount: 3200,
    reviewCount: 780,
    seller: "BeautyPlus",
    sellerRating: "4.7 / 5",
    price: 599,
    originalPrice: 599,
    discount: 0.15,
    isFlipkartAssured: true,
    image: "https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?w=800&auto=format&fit=crop&q=80"
    ],
    description: "Multi-use hair serum enriched with 6 rare flower oils. Tames frizz, seals split ends, and provides heat protection up to 230°C.",
    offers: [],
    specifications: {
      "Volume": "100 ml",
      "Hair Type": "All Hair Types"
    },
    aiSummary: {
      overall: "Top-rated hair serum for frizz control, non-sticky texture, and floral fragrance.",
      positive: ["Lightweight non-sticky texture", "Delightful fragrance"],
      negative: ["Glass bottle requires care"]
    },
    frequentlyBoughtTogether: [],
    reviews: generate45Reviews("prod-5", "L'Oreal Extraordinary Hair Oil", "L'Oreal Paris", "Beauty & Personal Care", 4.5)
  },

  {
    id: "prod-5b",
    name: "Minimalist 10% Vitamin C Face Serum",
    brand: "Minimalist",
    category: "Beauty & Personal Care",
    rating: 4.4,
    ratingCount: 5400,
    reviewCount: 1100,
    seller: "BeautyPlus",
    sellerRating: "4.7 / 5",
    price: 699,
    originalPrice: 699,
    discount: 0.10,
    isFlipkartAssured: true,
    image: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&auto=format&fit=crop&q=80"
    ],
    description: "Glow serum formulated with 10% Ethyl Ascorbic Acid, Acetyl Glucosamine, and Centella Water for skin brightening and spot reduction.",
    offers: [],
    specifications: {
      "Volume": "30 ml",
      "Active Ingredient": "10% Ethyl Ascorbic Acid"
    },
    aiSummary: {
      overall: "Dermatologist favourite serum for reducing dark spots, evening skin tone, and adding radiant glow.",
      positive: ["Reduces dark spots effectively", "Stable non-oxidizing formula"],
      negative: ["Tingling sensation on sensitive skin"]
    },
    frequentlyBoughtTogether: [],
    reviews: generate45Reviews("prod-5b", "Minimalist Vitamin C Serum", "Minimalist", "Beauty & Personal Care", 4.4)
  },

  {
    id: "prod-6",
    name: "Philips Daily Collection Air Fryer",
    brand: "Philips",
    category: "Home Appliances",
    rating: 4.6,
    ratingCount: 4120,
    reviewCount: 950,
    seller: "KitchenStore",
    sellerRating: "4.8 / 5",
    price: 13295,
    originalPrice: 13295,
    discount: 0.25,
    isFlipkartAssured: true,
    image: "https://images.unsplash.com/photo-1621972750749-0fbb1abb7736?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1621972750749-0fbb1abb7736?w=800&auto=format&fit=crop&q=80"
    ],
    description: "Healthy air frying technology using Rapid Air hot air circulation to cook crispy fries, snacks, and grills with up to 90% less oil.",
    offers: [],
    specifications: {
      "Capacity": "4.1 Liters",
      "Power": "1400 W"
    },
    aiSummary: {
      overall: "Customers love the 90% oil-free frying result, crispy texture for samosas & fries, and easy basket cleaning.",
      positive: ["Requires minimal oil", "Crispy snack texture"],
      negative: ["Power cable is short (1m)"]
    },
    frequentlyBoughtTogether: [],
    reviews: generate45Reviews("prod-6", "Philips Air Fryer", "Philips", "Home Appliances", 4.6)
  },

  {
    id: "prod-7",
    name: "Monopoly Deal Card Game for Families",
    brand: "Hasbro",
    category: "Books & Toys",
    rating: 4.2,
    ratingCount: 1450,
    reviewCount: 290,
    seller: "ToyWorld",
    sellerRating: "4.3 / 5",
    price: 335,
    originalPrice: 335,
    discount: 0.10,
    isFlipkartAssured: false,
    image: "https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?w=800&auto=format&fit=crop&q=80"
    ],
    description: "Fast-paced, addictive card game where your luck can change in the play of a single card.",
    offers: [],
    specifications: {
      "Age Group": "8+ Years",
      "Players": "2 to 5 Players"
    },
    aiSummary: {
      overall: "Fun, quick, strategic game praised by adults and kids alike.",
      positive: ["Fast 15-min game sessions", "High replay value"],
      negative: ["Card paper quality is thin"]
    },
    frequentlyBoughtTogether: [],
    reviews: generate45Reviews("prod-7", "Monopoly Deal", "Hasbro", "Books & Toys", 4.2)
  },

  {
    id: "prod-8",
    name: "Cosmic Byte CB-GK-16 Mechanical Keyboard",
    brand: "Cosmic Byte",
    category: "Electronics",
    rating: 4.0,
    ratingCount: 1650,
    reviewCount: 380,
    seller: "GamerNet",
    sellerRating: "4.4 / 5",
    price: 3570,
    originalPrice: 3570,
    discount: 0.30,
    isFlipkartAssured: true,
    image: "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=800&auto=format&fit=crop&q=80"
    ],
    description: "Outemu Blue switch mechanical gaming keyboard with customisable RGB backlighting profiles and aluminum chassis.",
    offers: [],
    specifications: {
      "Switch": "Outemu Blue Mechanical",
      "Backlight": "RGB Multi-Mode"
    },
    aiSummary: {
      overall: "Gamers love the clicky blue tactile feedback, sturdy metal top plate, and bright RGB modes.",
      positive: ["Satisfying mechanical click", "Solid aluminum top frame"],
      negative: ["Click sound is loud in quiet office"]
    },
    frequentlyBoughtTogether: [],
    reviews: generate45Reviews("prod-8", "Cosmic Byte Keyboard", "Cosmic Byte", "Electronics", 4.0)
  },

  {
    id: "prod-8b",
    name: "Logitech MX Master 3S Performance Mouse",
    brand: "Logitech",
    category: "Electronics",
    rating: 4.8,
    ratingCount: 7600,
    reviewCount: 1420,
    seller: "GamerNet",
    sellerRating: "4.9 / 5",
    price: 10995,
    originalPrice: 10995,
    discount: 0.18,
    isFlipkartAssured: true,
    image: "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=800&auto=format&fit=crop&q=80"
    ],
    description: "An iconic master re-engineered. Quiet Clicks, 8K DPI Darkfield glass tracking, MagSpeed electromagnetic scrolling wheel.",
    offers: [],
    specifications: {
      "Sensor": "8000 DPI Darkfield Glass Tracking",
      "Click Noise": "90% Quieter Clicks",
      "Battery": "70 Days on Full Charge"
    },
    aiSummary: {
      overall: "The ultimate productivity mouse for programmers and designers. Hyper-fast MagSpeed wheel and silent clicks.",
      positive: ["MagSpeed 1000 lines/sec scroll", "90% quiet click technology", "Works on glass surfaces"],
      negative: ["Designed specifically for right-handed users"]
    },
    frequentlyBoughtTogether: [],
    reviews: generate45Reviews("prod-8b", "Logitech MX Master 3S", "Logitech", "Electronics", 4.8)
  },

  {
    id: "prod-9",
    name: "Premium Leather Bi-fold Men's Wallet",
    brand: "Puma",
    category: "Fashion",
    rating: 4.2,
    ratingCount: 1120,
    reviewCount: 230,
    seller: "PumaRetail",
    sellerRating: "4.5 / 5",
    price: 2725,
    originalPrice: 2725,
    discount: 0.45,
    isFlipkartAssured: true,
    image: "https://images.unsplash.com/photo-1627124709743-4ac5036f3c02?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1627124709743-4ac5036f3c02?w=800&auto=format&fit=crop&q=80"
    ],
    description: "Genuine high-grade grain leather bi-fold wallet featuring 6 card compartments, RFID blocking layer, and coin pocket.",
    offers: [],
    specifications: {
      "Material": "100% Genuine Leather",
      "RFID": "Yes"
    },
    aiSummary: {
      overall: "Customers compliment the rich leather feel, slim profile, and RFID security feature.",
      positive: ["Genuine leather finish", "RFID protection"],
      negative: ["Coin pocket button stiff initially"]
    },
    frequentlyBoughtTogether: [],
    reviews: generate45Reviews("prod-9", "Puma Leather Wallet", "Puma", "Fashion", 4.2)
  },

  {
    id: "prod-10",
    name: "Neutrogena Hydro Boost Water Gel",
    brand: "Neutrogena",
    category: "Beauty & Personal Care",
    rating: 4.4,
    ratingCount: 2890,
    reviewCount: 640,
    seller: "SkincareIndia",
    sellerRating: "4.7 / 5",
    price: 1277,
    originalPrice: 1277,
    discount: 0.10,
    isFlipkartAssured: true,
    image: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&auto=format&fit=crop&q=80"
    ],
    description: "Clinically proven oil-free water gel moisturiser containing hyaluronic acid for 72-hour deep skin hydration.",
    offers: [],
    specifications: {
      "Volume": "50 grams",
      "Skin Type": "All Skin Types"
    },
    aiSummary: {
      overall: "Dermatologist-recommended water gel loved for lightweight hydration, zero oiliness, and glass skin finish.",
      positive: ["Absorbs instantly without shine", "Deep hyaluronic hydration"],
      negative: ["Price is premium for 50g jar"]
    },
    frequentlyBoughtTogether: [],
    reviews: generate45Reviews("prod-10", "Neutrogena Hydro Boost", "Neutrogena", "Beauty & Personal Care", 4.4)
  }
];

// Helper algorithm: Similar Product Recommendation Scoring (40/25/20/10/5 rule)
export function getRecommendedProducts(currentProduct: Product, allProducts: Product[], limit: number = 6): Product[] {
  const scored = allProducts
    .filter(p => p.id !== currentProduct.id)
    .map(candidate => {
      let score = 0;

      // 40% Same Category
      if (candidate.category.toLowerCase() === currentProduct.category.toLowerCase()) {
        score += 0.40;
      }

      // 25% Same Brand
      if (candidate.brand.toLowerCase() === currentProduct.brand.toLowerCase()) {
        score += 0.25;
      }

      // 20% Similar Price
      const currentFinalPrice = currentProduct.price * (1 - currentProduct.discount);
      const candidateFinalPrice = candidate.price * (1 - candidate.discount);
      const priceDiff = Math.abs(candidateFinalPrice - currentFinalPrice) / Math.max(1, currentFinalPrice);
      score += 0.20 * Math.max(0, 1 - priceDiff);

      // 10% Similar Rating
      const ratingDiff = Math.abs(candidate.rating - currentProduct.rating) / 5.0;
      score += 0.10 * Math.max(0, 1 - ratingDiff);

      // 5% Popularity
      const popScore = Math.min(1.0, (candidate.ratingCount || 500) / 5000.0);
      score += 0.05 * popScore;

      return { product: candidate, score };
    });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(item => item.product);
}
