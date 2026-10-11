// Seed destinations. `base` is the nightly price (₹) of a comfortable standard room there; listings scale from it
// by category and comfort level. `w` is a relative weight for how many of the 500 listings land in the place.
// `q` are the names used to search Wikimedia Commons for photos of the area.
const P = (name, state, lat, lng, base, w, cats, vibe, near, q) => ({ name, state, lat, lng, base, w, cats, vibe, near, q: q || [name.split(",")[0]] });

module.exports = [
  // ---- Goa & Konkan ----
  P("Calangute, Goa", "Goa", 15.5439, 73.7553, 4500, 14, ["beaches", "pools", "mansion", "rooms", "trending"], "the lively sands of North Goa", ["Baga Beach", "Fort Aguada"], ["Calangute", "Baga"]),
  P("Palolem, Goa", "Goa", 15.01, 74.0232, 3800, 8, ["beaches", "rooms", "farmhouses", "trending"], "the crescent bay of South Goa", ["Palolem Beach", "Cabo de Rama Fort"], ["Palolem", "Agonda"]),
  P("Alibaug, Maharashtra", "Maharashtra", 18.6414, 72.8722, 5500, 7, ["beaches", "pools", "farmhouses", "mansion"], "Mumbai's favourite weekend coast", ["Kashid Beach", "Murud-Janjira Fort"], ["Alibag", "Kashid"]),
  P("Tarkarli, Maharashtra", "Maharashtra", 16.01, 73.47, 2800, 4, ["beaches", "farmhouses", "rooms"], "the clear waters of the Konkan coast", ["Tarkarli Beach", "Sindhudurg Fort"], ["Tarkarli", "Malvan"]),
  P("Diu", "Daman and Diu", 20.7144, 70.9874, 2800, 3, ["beaches", "rooms", "mansion"], "a quiet Portuguese-era island town", ["Nagoa Beach", "Diu Fort"], ["Diu"]),
  P("Gokarna, Karnataka", "Karnataka", 14.5479, 74.3188, 2200, 7, ["beaches", "rooms", "farmhouses"], "unspoiled cliffs and coves", ["Om Beach", "Kudle Beach"], ["Gokarna"]),

  // ---- Kerala ----
  P("Varkala, Kerala", "Kerala", 8.7379, 76.7163, 3000, 7, ["beaches", "rooms", "pools"], "red cliffs above the Arabian Sea", ["Varkala Cliff", "Papanasam Beach"], ["Varkala"]),
  P("Kovalam, Kerala", "Kerala", 8.4004, 76.9787, 3500, 6, ["beaches", "pools", "rooms", "mansion"], "palm-lined crescent beaches", ["Lighthouse Beach", "Hawa Beach"], ["Kovalam"]),
  P("Alleppey, Kerala", "Kerala", 9.4981, 76.3388, 3800, 9, ["trending", "rooms", "farmhouses", "mansion"], "the still green backwaters", ["Vembanad Lake", "Alappuzha Beach"], ["Alappuzha", "Alleppey"]),
  P("Kochi, Kerala", "Kerala", 9.9312, 76.2673, 3800, 6, ["mansion", "rooms", "pools", "trending"], "the old spice-trade harbour", ["Fort Kochi", "Mattancherry"], ["Kochi", "Fort Kochi"]),
  P("Munnar, Kerala", "Kerala", 10.0889, 77.0595, 3200, 9, ["mountains", "farmhouses", "rooms", "trending"], "endless tea-covered hills", ["Eravikulam National Park", "Mattupetty Dam"], ["Munnar"]),
  P("Wayanad, Kerala", "Kerala", 11.6854, 76.132, 3000, 8, ["mountains", "farmhouses", "rooms", "trending"], "misty forests and spice plantations", ["Edakkal Caves", "Banasura Sagar Dam"], ["Wayanad"]),
  P("Thekkady, Kerala", "Kerala", 9.6, 77.17, 2800, 5, ["farmhouses", "rooms", "mountains"], "the edge of Periyar's wildlife reserve", ["Periyar Tiger Reserve", "Kumily spice market"], ["Thekkady", "Kumily"]),

  // ---- Tamil Nadu, Puducherry, Karnataka, Andhra, Telangana ----
  P("Pondicherry", "Puducherry", 11.9416, 79.8083, 3500, 7, ["beaches", "mansion", "rooms", "trending"], "the French Quarter's pastel lanes", ["Promenade Beach", "Auroville"], ["Pondicherry", "Puducherry"]),
  P("Mahabalipuram, Tamil Nadu", "Tamil Nadu", 12.6269, 80.1927, 3000, 5, ["beaches", "rooms", "pools"], "a shore of ancient rock-cut temples", ["Shore Temple", "Five Rathas"], ["Mahabalipuram", "Mamallapuram"]),
  P("Chennai, Tamil Nadu", "Tamil Nadu", 13.0827, 80.2707, 4000, 5, ["rooms", "mansion", "pools"], "the city of beaches and filter coffee", ["Marina Beach", "Mylapore"], ["Chennai"]),
  P("Ooty, Tamil Nadu", "Tamil Nadu", 11.4102, 76.695, 3000, 7, ["mountains", "farmhouses", "rooms"], "the queen of the Nilgiri hills", ["Ooty Lake", "Doddabetta Peak"], ["Ooty", "Udhagamandalam"]),
  P("Coonoor, Tamil Nadu", "Tamil Nadu", 11.353, 76.7959, 3000, 3, ["mountains", "farmhouses", "mansion"], "colonial tea estates in the Nilgiris", ["Sim's Park", "Dolphin's Nose"], ["Coonoor"]),
  P("Kodaikanal, Tamil Nadu", "Tamil Nadu", 10.2381, 77.4892, 2800, 6, ["mountains", "farmhouses", "rooms"], "pine forests above a star-shaped lake", ["Kodai Lake", "Coaker's Walk"], ["Kodaikanal"]),
  P("Yercaud, Tamil Nadu", "Tamil Nadu", 11.775, 78.209, 2400, 2, ["mountains", "farmhouses", "rooms"], "coffee hills in the Shevaroys", ["Yercaud Lake", "Lady's Seat"], ["Yercaud"]),
  P("Coorg, Karnataka", "Karnataka", 12.4244, 75.7382, 3200, 8, ["mountains", "farmhouses", "rooms", "trending"], "coffee estates wrapped in mist", ["Abbey Falls", "Raja's Seat"], ["Coorg", "Madikeri"]),
  P("Chikmagalur, Karnataka", "Karnataka", 13.3153, 75.7754, 2800, 6, ["mountains", "farmhouses", "rooms"], "Karnataka's coffee country", ["Mullayanagiri", "Kemmangundi"], ["Chikmagalur"]),
  P("Hampi, Karnataka", "Karnataka", 15.335, 76.46, 2200, 5, ["rooms", "farmhouses", "castles"], "boulder-strewn ruins of Vijayanagara", ["Virupaksha Temple", "Tungabhadra River"], ["Hampi"]),
  P("Mysore, Karnataka", "Karnataka", 12.2958, 76.6394, 3200, 5, ["castles", "mansion", "rooms"], "the city of palaces", ["Mysore Palace", "Chamundi Hill"], ["Mysore", "Mysuru"]),
  P("Bangalore, Karnataka", "Karnataka", 12.9716, 77.5946, 4500, 7, ["rooms", "mansion", "pools", "trending"], "India's garden city", ["Cubbon Park", "Indiranagar"], ["Bangalore", "Bengaluru"]),
  P("Hyderabad, Telangana", "Telangana", 17.385, 78.4867, 4000, 6, ["castles", "mansion", "rooms", "pools"], "the city of Nizams and pearls", ["Charminar", "Golconda Fort"], ["Hyderabad"]),
  P("Visakhapatnam, Andhra Pradesh", "Andhra Pradesh", 17.6868, 83.2185, 3200, 3, ["beaches", "rooms", "pools"], "a hill-backed Bay of Bengal shore", ["RK Beach", "Kailasagiri"], ["Visakhapatnam"]),
  P("Puri, Odisha", "Odisha", 19.8135, 85.8312, 2500, 3, ["beaches", "rooms"], "a pilgrim town on a wide golden beach", ["Puri Beach", "Konark Sun Temple"], ["Puri"]),

  // ---- Maharashtra hills & cities ----
  P("Mumbai, Maharashtra", "Maharashtra", 19.076, 72.8777, 6500, 8, ["rooms", "mansion", "pools", "trending"], "the city that never sleeps", ["Marine Drive", "Gateway of India"], ["Mumbai", "Bombay"]),
  P("Lonavala, Maharashtra", "Maharashtra", 18.7557, 73.4091, 4500, 8, ["pools", "mountains", "farmhouses", "mansion"], "monsoon-green Sahyadri weekends", ["Bhushi Dam", "Karla Caves"], ["Lonavala", "Khandala"]),
  P("Mahabaleshwar, Maharashtra", "Maharashtra", 17.9237, 73.6586, 3800, 6, ["mountains", "farmhouses", "rooms"], "strawberry farms on a plateau", ["Venna Lake", "Arthur's Seat"], ["Mahabaleshwar", "Panchgani"]),
  P("Pune, Maharashtra", "Maharashtra", 18.5204, 73.8567, 4200, 5, ["rooms", "mansion", "pools"], "Maratha heritage and café culture", ["Shaniwar Wada", "Sinhagad Fort"], ["Pune"]),
  P("Nashik, Maharashtra", "Maharashtra", 19.9975, 73.7898, 3500, 3, ["farmhouses", "pools", "rooms"], "vineyards on the Godavari", ["Sula Vineyards", "Pandavleni Caves"], ["Nashik"]),

  // ---- Gujarat & Rajasthan ----
  P("Kutch, Gujarat", "Gujarat", 23.88, 69.68, 3500, 4, ["farmhouses", "rooms", "trending"], "the white salt desert of the Rann", ["White Rann", "Bhuj"], ["Kutch", "Bhuj"]),
  P("Ahmedabad, Gujarat", "Gujarat", 23.0225, 72.5714, 3500, 4, ["mansion", "rooms", "castles"], "a UNESCO walled city of havelis", ["Sabarmati Ashram", "Old City pols"], ["Ahmedabad"]),
  P("Udaipur, Rajasthan", "Rajasthan", 24.5854, 73.7125, 5200, 10, ["castles", "pools", "mansion", "rooms", "trending"], "the lake city of white palaces", ["Lake Pichola", "City Palace"], ["Udaipur"]),
  P("Jaipur, Rajasthan", "Rajasthan", 26.9124, 75.7873, 4200, 10, ["castles", "mansion", "pools", "rooms", "trending"], "the Pink City of forts and bazaars", ["Amber Fort", "Hawa Mahal"], ["Jaipur"]),
  P("Jodhpur, Rajasthan", "Rajasthan", 26.2389, 73.0243, 3800, 6, ["castles", "mansion", "rooms"], "the blue city under Mehrangarh", ["Mehrangarh Fort", "Clock Tower market"], ["Jodhpur"]),
  P("Jaisalmer, Rajasthan", "Rajasthan", 26.9157, 70.9083, 3500, 6, ["castles", "farmhouses", "rooms"], "a golden fort rising from the Thar", ["Jaisalmer Fort", "Sam Sand Dunes"], ["Jaisalmer"]),
  P("Pushkar, Rajasthan", "Rajasthan", 26.49, 74.5513, 2800, 4, ["rooms", "farmhouses", "mansion"], "a sacred lake town in the desert", ["Pushkar Lake", "Brahma Temple"], ["Pushkar"]),
  P("Ranthambore, Rajasthan", "Rajasthan", 26.0173, 76.5026, 4000, 4, ["farmhouses", "mansion", "pools"], "tiger country around a hill fort", ["Ranthambore National Park", "Ranthambore Fort"], ["Ranthambore", "Sawai Madhopur"]),
  P("Mount Abu, Rajasthan", "Rajasthan", 24.5926, 72.7156, 3000, 3, ["mountains", "rooms", "castles"], "Rajasthan's only hill station", ["Nakki Lake", "Dilwara Temples"], ["Mount Abu"]),

  // ---- North India plains ----
  P("New Delhi", "Delhi", 28.6139, 77.209, 5500, 8, ["mansion", "rooms", "pools", "trending"], "Lutyens' avenues and Old Delhi lanes", ["India Gate", "Humayun's Tomb"], ["Delhi", "New Delhi"]),
  P("Agra, Uttar Pradesh", "Uttar Pradesh", 27.1767, 78.0081, 3800, 4, ["rooms", "mansion", "castles"], "the city of the Taj Mahal", ["Taj Mahal", "Agra Fort"], ["Agra"]),
  P("Varanasi, Uttar Pradesh", "Uttar Pradesh", 25.3176, 82.9739, 2500, 4, ["rooms", "mansion", "castles"], "ghats on the sacred Ganga", ["Dashashwamedh Ghat", "Sarnath"], ["Varanasi"]),
  P("Lucknow, Uttar Pradesh", "Uttar Pradesh", 26.8467, 80.9462, 3200, 3, ["mansion", "castles", "rooms"], "Awadhi grandeur and kebabs", ["Bara Imambara", "Rumi Darwaza"], ["Lucknow"]),
  P("Khajuraho, Madhya Pradesh", "Madhya Pradesh", 24.8318, 79.9199, 2800, 2, ["rooms", "farmhouses"], "a village of sculpted temples", ["Western Group of Temples", "Raneh Falls"], ["Khajuraho"]),
  P("Amritsar, Punjab", "Punjab", 31.634, 74.8723, 3000, 3, ["rooms", "mansion"], "the home of the Golden Temple", ["Golden Temple", "Wagah Border"], ["Amritsar"]),
  P("Chandigarh", "Chandigarh", 30.7333, 76.7794, 3500, 2, ["rooms", "pools", "mansion"], "Le Corbusier's planned city", ["Rock Garden", "Sukhna Lake"], ["Chandigarh"]),

  // ---- Himalaya ----
  P("Rishikesh, Uttarakhand", "Uttarakhand", 30.0869, 78.2676, 2800, 7, ["rooms", "mountains", "farmhouses"], "the yoga capital on the Ganga", ["Laxman Jhula", "Neelkanth Mahadev"], ["Rishikesh"]),
  P("Mussoorie, Uttarakhand", "Uttarakhand", 30.4598, 78.0644, 3800, 6, ["mountains", "mansion", "rooms"], "the queen of the hills", ["Kempty Falls", "Camel's Back Road"], ["Mussoorie"]),
  P("Nainital, Uttarakhand", "Uttarakhand", 29.3919, 79.4542, 3800, 6, ["mountains", "mansion", "rooms"], "a lake town ringed by seven hills", ["Naini Lake", "Snow View Point"], ["Nainital"]),
  P("Jim Corbett, Uttarakhand", "Uttarakhand", 29.53, 79.13, 3500, 4, ["farmhouses", "pools", "mansion"], "jungle stays beside the Kosi river", ["Corbett National Park", "Garjia Temple"], ["Corbett", "Ramnagar"]),
  P("Ranikhet, Uttarakhand", "Uttarakhand", 29.6434, 79.4322, 2800, 4, ["mountains", "farmhouses", "rooms"], "quiet pine ridges facing the peaks", ["Jhula Devi Temple", "Chaubatia Gardens"], ["Ranikhet", "Almora"]),
  P("Auli, Uttarakhand", "Uttarakhand", 30.53, 79.57, 3000, 2, ["mountains", "rooms"], "ski slopes under Nanda Devi", ["Auli Ropeway", "Joshimath"], ["Auli", "Joshimath"]),
  P("Shimla, Himachal Pradesh", "Himachal Pradesh", 31.1048, 77.1734, 3800, 6, ["mountains", "mansion", "rooms"], "colonial charm on a ridge", ["The Ridge", "Jakhu Temple"], ["Shimla"]),
  P("Manali, Himachal Pradesh", "Himachal Pradesh", 32.2432, 77.1892, 3500, 9, ["mountains", "farmhouses", "rooms", "trending"], "apple orchards under snow peaks", ["Solang Valley", "Hadimba Temple"], ["Manali"]),
  P("Kasol, Himachal Pradesh", "Himachal Pradesh", 32.01, 77.31, 2200, 4, ["mountains", "rooms", "farmhouses"], "the Parvati Valley riverside", ["Parvati River", "Malana"], ["Kasol", "Parvati Valley"]),
  P("Dharamshala, Himachal Pradesh", "Himachal Pradesh", 32.2426, 76.3213, 2800, 5, ["mountains", "rooms", "farmhouses"], "Tibetan culture below the Dhauladhars", ["Triund Trek", "Namgyal Monastery"], ["Dharamshala", "McLeod Ganj"]),
  P("Spiti Valley, Himachal Pradesh", "Himachal Pradesh", 32.2276, 78.0719, 2500, 3, ["mountains", "rooms"], "a cold desert of monasteries", ["Key Monastery", "Chandratal Lake"], ["Spiti", "Kaza"]),
  P("Leh, Ladakh", "Ladakh", 34.1526, 77.5771, 3500, 6, ["mountains", "rooms", "farmhouses"], "high-altitude Buddhist valleys", ["Shanti Stupa", "Pangong Lake"], ["Leh", "Ladakh"]),
  P("Srinagar, Jammu & Kashmir", "Jammu & Kashmir", 34.0837, 74.7973, 4000, 5, ["rooms", "mansion", "trending"], "houseboats on Dal Lake", ["Dal Lake", "Mughal Gardens"], ["Srinagar", "Dal Lake"]),
  P("Gulmarg, Jammu & Kashmir", "Jammu & Kashmir", 34.0484, 74.3805, 4500, 3, ["mountains", "rooms"], "a meadow turned ski resort", ["Gulmarg Gondola", "Alpather Lake"], ["Gulmarg"]),
  P("Pahalgam, Jammu & Kashmir", "Jammu & Kashmir", 34.0161, 75.315, 3200, 3, ["mountains", "farmhouses", "rooms"], "the Lidder valley's pine meadows", ["Betaab Valley", "Aru Valley"], ["Pahalgam"]),

  // ---- East & North-East ----
  P("Darjeeling, West Bengal", "West Bengal", 27.036, 88.2627, 3200, 6, ["mountains", "rooms", "farmhouses", "mansion"], "tea gardens facing Kanchenjunga", ["Tiger Hill", "Batasia Loop"], ["Darjeeling"]),
  P("Kolkata, West Bengal", "West Bengal", 22.5726, 88.3639, 3500, 4, ["mansion", "rooms", "castles"], "a city of old bungalows and trams", ["Victoria Memorial", "Howrah Bridge"], ["Kolkata", "Calcutta"]),
  P("Gangtok, Sikkim", "Sikkim", 27.3389, 88.6065, 3500, 4, ["mountains", "rooms", "farmhouses"], "monasteries above the Teesta", ["MG Marg", "Tsomgo Lake"], ["Gangtok"]),
  P("Pelling, Sikkim", "Sikkim", 27.3, 88.24, 2800, 2, ["mountains", "rooms"], "ridge-top views of Kanchenjunga", ["Pemayangtse Monastery", "Rabdentse Ruins"], ["Pelling"]),
  P("Shillong, Meghalaya", "Meghalaya", 25.5788, 91.8933, 2800, 3, ["mountains", "rooms", "farmhouses"], "Scotland of the East", ["Umiam Lake", "Elephant Falls"], ["Shillong"]),
  P("Cherrapunji, Meghalaya", "Meghalaya", 25.27, 91.72, 2500, 2, ["mountains", "farmhouses"], "living root bridges in the rain", ["Nohkalikai Falls", "Double Decker Root Bridge"], ["Cherrapunji", "Sohra"]),
  P("Kaziranga, Assam", "Assam", 26.5775, 93.1711, 3500, 3, ["farmhouses", "rooms", "pools"], "one-horned rhino country", ["Kaziranga National Park", "Kohora"], ["Kaziranga"]),
  P("Tawang, Arunachal Pradesh", "Arunachal Pradesh", 27.586, 91.859, 2800, 2, ["mountains", "rooms"], "a high monastery town", ["Tawang Monastery", "Sela Pass"], ["Tawang"]),

  // ---- Islands & central ----
  P("Havelock Island, Andaman", "Andaman and Nicobar", 11.971, 92.989, 6000, 5, ["beaches", "rooms", "pools"], "turquoise water and white sand", ["Radhanagar Beach", "Elephant Beach"], ["Havelock", "Andaman"]),
  P("Pachmarhi, Madhya Pradesh", "Madhya Pradesh", 22.4674, 78.4346, 2500, 2, ["mountains", "rooms"], "Satpura's only hill station", ["Bee Falls", "Dhoopgarh"], ["Pachmarhi"]),
  P("Kanha, Madhya Pradesh", "Madhya Pradesh", 22.334, 80.6119, 4000, 2, ["farmhouses", "mansion", "pools"], "the sal forests of The Jungle Book", ["Kanha National Park", "Mukki Gate"], ["Kanha"]),
];
