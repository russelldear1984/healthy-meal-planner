export type Recipe = { id: string; title: string; image_url: string; source_url?: string | null; source_name: string; tags: string[]; ingredients: { name: string; quantity?: number | null; unit?: string | null; raw_text: string }[] }

const make = (id: string, title: string, image: string, tags: string[], ingredients: string[]): Recipe => ({
  id, title, image_url: image, source_name: 'TheMealDB', source_url: null, tags: ['main-course', ...tags],
  ingredients: ingredients.map((raw_text) => ({ name: raw_text.replace(/^.*?\s(?:cup|tbsp|tsp|g|ml|oz|lb|cloves?)\s/i, '').replace(/^\d+[\d./]*\s*/, ''), raw_text })),
})

export const demoRecipes: Recipe[] = [
  make('52871', 'Yaki Udon', 'https://www.themealdb.com/images/media/meals/wrustq1511475474.jpg', ['dinner', 'japanese', 'low-carb-candidate'], ['2 tbsp sesame oil', '2 cloves garlic', '1 red pepper', '200 g chicken breast', '2 tbsp soy sauce']),
  make('52959', 'Baked salmon with fennel', 'https://www.themealdb.com/images/media/meals/1548772327.jpg', ['dinner', 'british', 'low-carb-candidate'], ['2 salmon fillets', '1 fennel bulb', '1 lemon', '2 tbsp olive oil', '1 cup cherry tomatoes']),
  make('53026', 'Braised beef chilli', 'https://www.themealdb.com/images/media/meals/uuuspp1511297945.jpg', ['dinner', 'american', 'low-carb-candidate'], ['500 g beef', '1 onion', '2 cloves garlic', '1 tbsp paprika', '1 tin tomatoes']),
  make('52944', 'Escovitch Fish', 'https://www.themealdb.com/images/media/meals/1520084413.jpg', ['dinner', 'jamaican', 'low-carb-candidate'], ['2 fish fillets', '1 onion', '1 red pepper', '1 lime', '2 tbsp olive oil']),
  make('52843', 'Hummus', 'https://www.themealdb.com/images/media/meals/1550259443.jpg', ['dinner', 'middle eastern', 'low-carb-candidate'], ['1 tin chickpeas', '2 tbsp tahini', '1 lemon', '2 cloves garlic', '2 tbsp olive oil']),
  make('52772', 'Teriyaki Chicken Casserole', 'https://www.themealdb.com/images/media/meals/wvpsxx1468256321.jpg', ['dinner', 'japanese', 'low-carb-candidate'], ['500 g chicken breast', '1 broccoli', '2 cloves garlic', '2 tbsp soy sauce', '1 tbsp sesame oil']),
  make('53065', 'Chicken Enchilada Casserole', 'https://www.themealdb.com/images/media/meals/qrqywr1503066605.jpg', ['dinner', 'mexican', 'low-carb-candidate'], ['400 g chicken breast', '1 onion', '1 red pepper', '1 cup cheese', '2 tbsp olive oil']),
  make('52993', 'Tuna Nicoise', 'https://www.themealdb.com/images/media/meals/yypwwq1511304979.jpg', ['dinner', 'french', 'low-carb-candidate'], ['2 tuna steaks', '2 eggs', '1 cup green beans', '1 lemon', '2 tbsp olive oil']),
  make('53048', 'Spanish Tortilla', 'https://www.themealdb.com/images/media/meals/quuxsx1511476154.jpg', ['dinner', 'spanish', 'low-carb-candidate'], ['6 eggs', '1 onion', '2 tbsp olive oil', '1 red pepper', '1 cup spinach']),
]
