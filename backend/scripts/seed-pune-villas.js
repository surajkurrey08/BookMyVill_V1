const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const villasData = [
  {
    "name": "Villa 108 Sierra Vista",
    "type": "Villa",
    "location": "Amarja Hills, Pawna Dam Road, Lonavala, Maharashtra",
    "price": 27000,
    "bookingMode": "ENTIRE",
    "websiteVisible": true,
    "status": "approved",
    "coordinates": {
      "lat": 18.6525,
      "lng": 73.4935
    },
    "mapLink": "https://maps.google.com/?q=18.6525,73.4935",
    "amenities": [
      "Private Pool",
      "WiFi",
      "AC",
      "Mountain View",
      "Lawn",
      "BBQ",
      "Power Backup",
      "Pet Friendly",
      "Caretaker"
    ],
    "facilities": [
      "Private Parking",
      "Equipped Kitchen",
      "Music System",
      "Indoor Games",
      "Gazebo"
    ],
    "photos": [
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600607687644-c7171b42498f?auto=format&fit=crop&w=1200&q=80"
    ],
    "listingData": {
      "title": "4 BHK Luxury Pool Villa with Scenic Hill Views",
      "description": "Villa 108 Sierra Vista is part of the Amarja Hills private villa collection near Pawna Dam in the Lonavala region. The property is marketed as a premium group getaway with spacious interiors, private accommodation, and scenic surroundings suited to family holidays and celebrations.\n\nGuests can plan a relaxing escape with time for leisurely meals, outdoor gatherings, and exploring the nearby Sahyadri landscape.",
      "bedrooms": 4,
      "bathrooms": 4,
      "maxGuests": 15
    },
    "stayInfo": {
      "checkInTime": "2:00 PM",
      "checkOutTime": "11:00 AM",
      "wifiName": "SierraVista_Guest_WiFi",
      "houseRules": [
        "Government ID required at check-in",
        "No loud music outdoors after 10:00 PM",
        "Pool timings: 7:00 AM to 9:00 PM",
        "Smoking is permitted only in designated areas"
      ],
      "arrivalNotes": "Located in the Amarja Hills villa collection near Pawna Dam Road, Lonavala.",
      "foodInfo": "In-house cook available on request. Vegetarian and non-vegetarian home-cooked meals prepared fresh."
    }
  },
  {
    "name": "Villa 199 Sunset Retreat",
    "type": "Villa",
    "location": "Amarja Hills, Pawna Dam Road, Lonavala, Maharashtra",
    "price": 40000,
    "bookingMode": "ENTIRE",
    "websiteVisible": true,
    "status": "approved",
    "coordinates": {
      "lat": 18.6525,
      "lng": 73.4935
    },
    "mapLink": "https://maps.google.com/?q=18.6525,73.4935",
    "amenities": [
      "Private Pool",
      "WiFi",
      "AC",
      "Mountain View",
      "Lawn",
      "BBQ",
      "Power Backup",
      "Pet Friendly",
      "Caretaker"
    ],
    "facilities": [
      "Private Parking",
      "Equipped Kitchen",
      "Music System",
      "Indoor Games",
      "Gazebo"
    ],
    "photos": [
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600607687644-c7171b42498f?auto=format&fit=crop&w=1200&q=80"
    ],
    "listingData": {
      "title": "6 BHK Luxury Villa for Groups and Family Getaways",
      "description": "Villa 199 Sunset Retreat is listed within the Amarja Hills collection near Pawna Dam, Lonavala. The property is positioned for larger groups looking for a private holiday home close to the hills and lake landscape of the Western Ghats.\n\nThe villa offers a setting for family reunions, group weekends, and private celebrations.",
      "bedrooms": 6,
      "bathrooms": 6,
      "maxGuests": 14
    },
    "stayInfo": {
      "checkInTime": "2:00 PM",
      "checkOutTime": "11:00 AM",
      "wifiName": "SunsetRetreat_Guest_WiFi",
      "houseRules": [
        "Government ID required at check-in",
        "No loud music outdoors after 10:00 PM",
        "Pool timings: 7:00 AM to 9:00 PM",
        "Smoking is permitted only in designated areas"
      ],
      "arrivalNotes": "Located in the Amarja Hills collection near Pawna Dam Road, Lonavala.",
      "foodInfo": "Dedicated in-house chef available. Veg and Non-veg meal packages prepared with prior notice."
    }
  },
  {
    "name": "Villa 27 The Mountain Crest",
    "type": "Villa",
    "location": "Amarja Hills, Pawna Dam Road, Lonavala, Maharashtra",
    "price": 35000,
    "bookingMode": "ENTIRE",
    "websiteVisible": true,
    "status": "approved",
    "coordinates": {
      "lat": 18.6525,
      "lng": 73.4935
    },
    "mapLink": "https://maps.google.com/?q=18.6525,73.4935",
    "amenities": [
      "Private Pool",
      "WiFi",
      "AC",
      "Mountain View",
      "Lawn",
      "BBQ",
      "Power Backup",
      "Pet Friendly",
      "Caretaker"
    ],
    "facilities": [
      "Private Parking",
      "Equipped Kitchen",
      "Music System",
      "Indoor Games",
      "Gazebo"
    ],
    "photos": [
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600607687644-c7171b42498f?auto=format&fit=crop&w=1200&q=80"
    ],
    "listingData": {
      "title": "4 BHK Luxury Mountain Retreat with Private Pool",
      "description": "Villa 27 The Mountain Crest is part of the Amarja Hills private villa collection in the Pawna Dam area near Lonavala. Its four-bedroom configuration makes it an ideal retreat for families and groups seeking a private base for a weekend in Maharashtra's Sahyadri region.",
      "bedrooms": 4,
      "bathrooms": 4,
      "maxGuests": 18
    },
    "stayInfo": {
      "checkInTime": "2:00 PM",
      "checkOutTime": "11:00 AM",
      "wifiName": "MountainCrest_Guest_WiFi",
      "houseRules": [
        "Government ID required at check-in",
        "No loud music outdoors after 10:00 PM",
        "Pool timings: 7:00 AM to 9:00 PM",
        "Smoking is permitted only in designated areas"
      ],
      "arrivalNotes": "Amarja Hills, Pawna Dam Road, Lonavala. Landmark: Near Amarja Gate 1.",
      "foodInfo": "Kitchen fully equipped for self-cooking or caretaker meal preparation service available."
    }
  },
  {
    "name": "Villa 29 Pinewood Manor",
    "type": "Villa",
    "location": "Amarja Hills, Pawna Dam Road, Lonavala, Maharashtra",
    "price": 30000,
    "bookingMode": "ENTIRE",
    "websiteVisible": true,
    "status": "approved",
    "coordinates": {
      "lat": 18.6525,
      "lng": 73.4935
    },
    "mapLink": "https://maps.google.com/?q=18.6525,73.4935",
    "amenities": [
      "Private Pool",
      "WiFi",
      "AC",
      "Mountain View",
      "Lawn",
      "BBQ",
      "Power Backup",
      "Pet Friendly",
      "Caretaker"
    ],
    "facilities": [
      "Private Parking",
      "Equipped Kitchen",
      "Music System",
      "Indoor Games",
      "Gazebo"
    ],
    "photos": [
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600607687644-c7171b42498f?auto=format&fit=crop&w=1200&q=80"
    ],
    "listingData": {
      "title": "4 BHK Private Holiday Villa near Pawna Dam",
      "description": "Villa 29 Pinewood Manor is part of the Amarja Hills collection near Pawna Dam in the Lonavala region. It is designed for families and groups looking for an entire-villa stay within reach of the lake and surrounding hill country.",
      "bedrooms": 4,
      "bathrooms": 4,
      "maxGuests": 15
    },
    "stayInfo": {
      "checkInTime": "2:00 PM",
      "checkOutTime": "11:00 AM",
      "wifiName": "Pinewood_Guest_WiFi",
      "houseRules": [
        "Government ID required at check-in",
        "No loud music outdoors after 10:00 PM",
        "Pool timings: 7:00 AM to 9:00 PM",
        "Smoking is permitted only in designated areas"
      ],
      "arrivalNotes": "Amarja Hills, Pawna Dam Road, Lonavala.",
      "foodInfo": "Catering and barbecue setups available on pre-order."
    }
  },
  {
    "name": "Villa 107 The Lake House",
    "type": "Villa",
    "location": "Amarja Hills, Pawna Dam Road, Lonavala, Maharashtra",
    "price": 25000,
    "bookingMode": "ENTIRE",
    "websiteVisible": true,
    "status": "approved",
    "coordinates": {
      "lat": 18.6525,
      "lng": 73.4935
    },
    "mapLink": "https://maps.google.com/?q=18.6525,73.4935",
    "amenities": [
      "Private Pool",
      "WiFi",
      "AC",
      "Mountain View",
      "Lawn",
      "BBQ",
      "Power Backup",
      "Pet Friendly",
      "Caretaker"
    ],
    "facilities": [
      "Private Parking",
      "Equipped Kitchen",
      "Music System",
      "Indoor Games",
      "Gazebo"
    ],
    "photos": [
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600607687644-c7171b42498f?auto=format&fit=crop&w=1200&q=80"
    ],
    "listingData": {
      "title": "3 BHK Lake Region Villa for a Private Weekend Stay",
      "description": "Villa 107 The Lake House is part of the Amarja Hills villa collection near Pawna Dam, Lonavala. Its scenic three-bedroom layout suits families and groups planning a peaceful break in the scenic lake-and-hills region.",
      "bedrooms": 3,
      "bathrooms": 3,
      "maxGuests": 8
    },
    "stayInfo": {
      "checkInTime": "2:00 PM",
      "checkOutTime": "11:00 AM",
      "wifiName": "LakeHouse_Guest_WiFi",
      "houseRules": [
        "Government ID required at check-in",
        "No loud music outdoors after 10:00 PM",
        "Pool timings: 7:00 AM to 9:00 PM",
        "Smoking is permitted only in designated areas"
      ],
      "arrivalNotes": "Amarja Hills, Pawna Dam Road, Lonavala.",
      "foodInfo": "Chef on request. Authentic Maharashtrian & North Indian food available."
    }
  },
  {
    "name": "Ecstasy Villa",
    "type": "Villa",
    "location": "Pawna Dam Area, Maval, Pune District, Maharashtra",
    "price": 35000,
    "bookingMode": "ENTIRE",
    "websiteVisible": true,
    "status": "approved",
    "coordinates": {
      "lat": 18.654,
      "lng": 73.493
    },
    "mapLink": "https://maps.google.com/?q=18.654,73.493",
    "amenities": [
      "Private Pool",
      "WiFi",
      "AC",
      "Mountain View",
      "Lawn",
      "BBQ",
      "Power Backup",
      "Pet Friendly",
      "Caretaker"
    ],
    "facilities": [
      "Private Parking",
      "Equipped Kitchen",
      "Music System",
      "Indoor Games",
      "Gazebo"
    ],
    "photos": [
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600607687644-c7171b42498f?auto=format&fit=crop&w=1200&q=80"
    ],
    "listingData": {
      "title": "5 BHK Private Pool Villa near Pawna Dam",
      "description": "Ecstasy Villa is a five-bedroom premium property in the Pawna Dam area of the Lonavala region with capacity for approximately 15 guests, making it a great choice for family gatherings and celebrations.\n\nThe Pawna area is known for its reservoir and Sahyadri scenery, ideal for weekend escapes from Pune and Mumbai.",
      "bedrooms": 5,
      "bathrooms": 5,
      "maxGuests": 15
    },
    "stayInfo": {
      "checkInTime": "2:00 PM",
      "checkOutTime": "11:00 AM",
      "wifiName": "Ecstasy_Guest_WiFi",
      "houseRules": [
        "Government ID required at check-in",
        "No loud music outdoors after 10:00 PM",
        "Pool timings: 7:00 AM to 9:00 PM",
        "Smoking is permitted only in designated areas"
      ],
      "arrivalNotes": "Pawna Dam area, Maval. Approach via Kamshet-Pawna route.",
      "foodInfo": "In-villa dining, personal chef, and meal packages available."
    }
  },
  {
    "name": "Sunset Retreat Villa",
    "type": "Villa",
    "location": "Maval, Pawna Lake Region, Pune District, Maharashtra",
    "price": 70000,
    "bookingMode": "ENTIRE",
    "websiteVisible": true,
    "status": "approved",
    "coordinates": {
      "lat": 18.654,
      "lng": 73.493
    },
    "mapLink": "https://maps.google.com/?q=18.654,73.493",
    "amenities": [
      "Private Pool",
      "WiFi",
      "AC",
      "Mountain View",
      "Lawn",
      "BBQ",
      "Power Backup",
      "Pet Friendly",
      "Caretaker"
    ],
    "facilities": [
      "Private Parking",
      "Equipped Kitchen",
      "Music System",
      "Indoor Games",
      "Gazebo"
    ],
    "photos": [
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600607687644-c7171b42498f?auto=format&fit=crop&w=1200&q=80"
    ],
    "listingData": {
      "title": "6 BHK Luxury Group Villa with Pool and Hill Views",
      "description": "Sunset Retreat Villa is a premier luxury estate in the Pawna Lake region of Maval. Designed for premium group stays, it features six spacious en-suite bedrooms, sweeping lake and hill vistas, an infinity-style pool, and expansive manicured lawns.",
      "bedrooms": 6,
      "bathrooms": 7,
      "maxGuests": 14
    },
    "stayInfo": {
      "checkInTime": "2:00 PM",
      "checkOutTime": "11:00 AM",
      "wifiName": "SunsetRetreat_VIP_WiFi",
      "houseRules": [
        "Government ID required at check-in",
        "No loud music outdoors after 10:00 PM",
        "Pool timings: 7:00 AM to 9:00 PM",
        "Smoking is permitted only in designated areas"
      ],
      "arrivalNotes": "Maval, Pawna Lake region. Private gated entry.",
      "foodInfo": "Customized barbecue setups and gourmet catering available."
    }
  },
  {
    "name": "White Castle Villa",
    "type": "Villa",
    "location": "Lonavala, Pune District, Maharashtra",
    "price": 90000,
    "bookingMode": "ENTIRE",
    "websiteVisible": true,
    "status": "approved",
    "coordinates": {
      "lat": 18.754,
      "lng": 73.406
    },
    "mapLink": "https://maps.google.com/?q=18.754,73.406",
    "amenities": [
      "Private Pool",
      "WiFi",
      "AC",
      "Mountain View",
      "Lawn",
      "BBQ",
      "Power Backup",
      "Pet Friendly",
      "Caretaker"
    ],
    "facilities": [
      "Private Parking",
      "Equipped Kitchen",
      "Music System",
      "Indoor Games",
      "Gazebo"
    ],
    "photos": [
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600607687644-c7171b42498f?auto=format&fit=crop&w=1200&q=80"
    ],
    "listingData": {
      "title": "7 BHK Luxury Villa for Large Groups in Lonavala",
      "description": "White Castle Villa is an expansive seven-bedroom luxury estate in the heart of Lonavala accommodating up to 20 guests. Complete with a private designer pool, gazebo, game zone, and lush gardens, it is built for family reunions and high-end retreats.",
      "bedrooms": 7,
      "bathrooms": 7,
      "maxGuests": 20
    },
    "stayInfo": {
      "checkInTime": "2:00 PM",
      "checkOutTime": "11:00 AM",
      "wifiName": "WhiteCastle_WiFi",
      "houseRules": [
        "Government ID required at check-in",
        "No loud music outdoors after 10:00 PM",
        "Pool timings: 7:00 AM to 9:00 PM",
        "Smoking is permitted only in designated areas"
      ],
      "arrivalNotes": "Lonavala, Pune District. Conveniently situated 10 mins from the Expressway exit.",
      "foodInfo": "Full housekeeping and professional chef team present on-site."
    }
  },
  {
    "name": "Luxe Lake Escape",
    "type": "Villa",
    "location": "Pawna Lake, Lonavala Region, Pune District, Maharashtra",
    "price": 28000,
    "bookingMode": "ENTIRE",
    "websiteVisible": true,
    "status": "approved",
    "coordinates": {
      "lat": 18.654,
      "lng": 73.493
    },
    "mapLink": "https://maps.google.com/?q=18.654,73.493",
    "amenities": [
      "Private Pool",
      "WiFi",
      "AC",
      "Mountain View",
      "Lawn",
      "BBQ",
      "Power Backup",
      "Pet Friendly",
      "Caretaker"
    ],
    "facilities": [
      "Private Parking",
      "Equipped Kitchen",
      "Music System",
      "Indoor Games",
      "Gazebo"
    ],
    "photos": [
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600607687644-c7171b42498f?auto=format&fit=crop&w=1200&q=80"
    ],
    "listingData": {
      "title": "5 BHK Luxury Lakeview Villa for Large Groups",
      "description": "Luxe Lake Escape is a five-bedroom lakeside villa in the Pawna Lake area near Lonavala. Built to accommodate up to 25 guests, it offers panoramic water views, spacious lawns, an open-air pool deck, and serene natural surroundings.",
      "bedrooms": 5,
      "bathrooms": 7,
      "maxGuests": 25
    },
    "stayInfo": {
      "checkInTime": "2:00 PM",
      "checkOutTime": "11:00 AM",
      "wifiName": "LuxeLake_WiFi",
      "houseRules": [
        "Government ID required at check-in",
        "No loud music outdoors after 10:00 PM",
        "Pool timings: 7:00 AM to 9:00 PM",
        "Smoking is permitted only in designated areas"
      ],
      "arrivalNotes": "Pawna Lake, Lonavala region. Direct waterfront approach road.",
      "foodInfo": "Complimentary morning breakfast buffet and on-demand personal chef for meals."
    }
  },
  {
    "name": "Ashvida Premium Villa",
    "type": "Villa",
    "location": "Kumbhroshi Village, Mahabaleshwar Region, Satara District, Maharashtra",
    "price": 25000,
    "bookingMode": "ENTIRE",
    "websiteVisible": true,
    "status": "approved",
    "coordinates": {
      "lat": 17.9237,
      "lng": 73.6586
    },
    "mapLink": "https://maps.google.com/?q=17.9237,73.6586",
    "amenities": [
      "Private Pool",
      "WiFi",
      "AC",
      "Mountain View",
      "Lawn",
      "BBQ",
      "Power Backup",
      "Pet Friendly",
      "Caretaker"
    ],
    "facilities": [
      "Private Parking",
      "Equipped Kitchen",
      "Music System",
      "Indoor Games",
      "Gazebo"
    ],
    "photos": [
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600607687644-c7171b42498f?auto=format&fit=crop&w=1200&q=80"
    ],
    "listingData": {
      "title": "4 Bedroom Premium Villa with Pool in Mahabaleshwar Region",
      "description": "Ashvida is a premium four-bedroom villa in Kumbhroshi Village near Mahabaleshwar. Set amidst strawberry fields and Sahyadri valleys, it features private pool access, barbecue facilities, and mountain views.",
      "bedrooms": 4,
      "bathrooms": 4,
      "maxGuests": 12
    },
    "stayInfo": {
      "checkInTime": "2:00 PM",
      "checkOutTime": "11:00 AM",
      "wifiName": "Ashvida_Guest_WiFi",
      "houseRules": [
        "Government ID required at check-in",
        "No loud music outdoors after 10:00 PM",
        "Pool timings: 7:00 AM to 9:00 PM",
        "Smoking is permitted only in designated areas"
      ],
      "arrivalNotes": "Kumbhroshi Village, Mahabaleshwar region.",
      "foodInfo": "Delicious local Mahabaleshwar specialties and barbecue dinners arranged by the host."
    }
  }
];

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI not found in backend/.env');
    process.exit(1);
  }

  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(uri);
  console.log(`✅ Connected to database: "${mongoose.connection.name}"`);

  const db = mongoose.connection.db;

  // 1. Backup existing properties
  const backupDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const existing = await db.collection('properties').find({}).toArray();
  const backupFile = path.join(backupDir, `properties_backup_${Date.now()}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(existing, null, 2), 'utf8');
  console.log(`📦 Backed up ${existing.length} existing properties to: ${backupFile}`);

  // 2. Resolve Host/Owner
  let ownerUser = await db.collection('users').findOne({ email: 'owner@mahabaleshwarstays.com' });
  if (!ownerUser) {
    ownerUser = await db.collection('users').findOne({ role: 'owner' });
  }
  if (!ownerUser) {
    ownerUser = await db.collection('users').findOne({ role: 'admin' });
  }
  const ownerId = ownerUser._id;
  console.log(`👤 Using Owner ID: ${ownerId} (${ownerUser.name || ownerUser.email})`);

  // 3. Delete old dummy properties & associated dummy rooms
  const deleteResult = await db.collection('properties').deleteMany({});
  console.log(`🗑️ Deleted ${deleteResult.deletedCount} old/dummy properties.`);
  await db.collection('rooms').deleteMany({});
  console.log(`🗑️ Cleaned up old room records.`);

  // 4. Insert 10 Real Villas
  const preparedVillas = villasData.map((v) => ({
    owner: ownerId,
    managementMode: 'BOOKMYVILLA_MANAGED',
    bookingMode: 'ENTIRE',
    websiteVisible: true,
    verification: {
      status: 'verified',
      note: 'Verified BookMyVilla Luxury Villa',
      reviewedAt: new Date()
    },
    status: 'approved',
    name: v.name,
    type: v.type || 'Villa',
    location: v.location,
    price: v.price,
    coordinates: v.coordinates,
    mapLink: v.mapLink,
    amenities: v.amenities,
    facilities: v.facilities,
    photos: v.photos,
    listingData: v.listingData,
    stayInfo: v.stayInfo,
    createdAt: new Date()
  }));

  const insertResult = await db.collection('properties').insertMany(preparedVillas);
  console.log(`\n🎉 Successfully inserted ${insertResult.insertedCount} real villas for Pune Division:`);

  const inserted = await db.collection('properties').find({}).toArray();
  inserted.forEach((v, idx) => {
    console.log(` ${idx + 1}. [${v.name}] in ${v.location} - ₹${v.price.toLocaleString('en-IN')}/night (ID: ${v._id})`);
  });

  await mongoose.disconnect();
  console.log('\n✅ Database disconnected. Seeding completed successfully!');
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});

