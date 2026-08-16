// FINAL_SYNC_RECIPES_CODE — paste this entire file into the Supabase editor.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type Meal = Record<string, string | null>
type IngredientRow = { recipe_id: string; ingredient_id: string; quantity: number | null; unit: string | null; raw_text: string }
const STARCHY_MAINS = ['pasta', 'rice', 'bread', 'potato', 'flour', 'noodle', 'couscous', 'quinoa']

function parseMeasure(raw: string) {
  const match = raw.trim().match(/^([\d./]+)\s*(.*)$/)
  if (!match) return { quantity: null, unit: raw.trim() || null }
  const quantity = match[1].includes('/') ? match[1].split('/').reduce((a, b) => Number(a) / Number(b)) : Number(match[1])
  return { quantity: Number.isFinite(quantity) ? quantity : null, unit: match[2].trim() || null }
}

function ingredientsFor(meal: Meal) {
  return Array.from({ length: 20 }, (_, index) => index + 1).map((number) => ({
    name: meal[`strIngredient${number}`]?.trim().toLowerCase(), measure: meal[`strMeasure${number}`]?.trim() ?? '',
  })).filter((item): item is { name: string; measure: string } => Boolean(item.name))
}

function tagsFor(meal: Meal, ingredients: string[]) {
  const category = meal.strCategory?.toLowerCase()
  const course = category === 'dessert' ? 'course-dessert' : category === 'starter' ? 'course-starter' : 'course-main'
  const tags = new Set(['dinner', course])
  if (meal.strCategory) tags.add(meal.strCategory.toLowerCase())
  if (meal.strArea) tags.add(meal.strArea.toLowerCase())
  if (!STARCHY_MAINS.some((term) => ingredients.join(' ').includes(term))) tags.add('low-carb-candidate')
  return [...tags]
}

async function importMeals(db: ReturnType<typeof createClient>, meals: Meal[]) {
  const uniqueMeals = [...new Map(meals.filter((meal) => meal.idMeal && meal.strMeal).map((meal) => [meal.idMeal!, meal])).values()]
  if (!uniqueMeals.length) return { imported: 0, skipped: meals.length }
  const sourceIds = uniqueMeals.map((meal) => meal.idMeal!)
  const { error: recipesError } = await db.from('recipes').upsert(uniqueMeals.map((meal) => ({
    source_recipe_id: meal.idMeal!, title: meal.strMeal!, image_url: meal.strMealThumb,
    source_url: meal.strSource || meal.strYoutube, source_name: 'TheMealDB', updated_at: new Date().toISOString(),
  })), { onConflict: 'source_recipe_id', ignoreDuplicates: true })
  if (recipesError) throw new Error(`recipes: ${recipesError.message}`)
  const { data: storedRecipes, error: readRecipesError } = await db.from('recipes').select('id, source_recipe_id').in('source_recipe_id', sourceIds)
  if (readRecipesError || !storedRecipes) throw new Error(`recipes read: ${readRecipesError?.message ?? 'missing results'}`)
  const idBySource = new Map(storedRecipes.map((recipe) => [recipe.source_recipe_id, recipe.id]))
  const prepared = uniqueMeals.map((meal) => ({ meal, recipeId: idBySource.get(meal.idMeal!)!, ingredients: ingredientsFor(meal) }))
  const ingredientNames = [...new Set(prepared.flatMap((item) => item.ingredients.map((ingredient) => ingredient.name)))]
  if (ingredientNames.length) {
    const { error } = await db.from('ingredients').upsert(ingredientNames.map((name) => ({ name })), { onConflict: 'name', ignoreDuplicates: true })
    if (error) throw new Error(`ingredients: ${error.message}`)
  }
  const { data: storedIngredients, error: readIngredientsError } = await db.from('ingredients').select('id, name').in('name', ingredientNames)
  if (readIngredientsError || !storedIngredients) throw new Error(`ingredients read: ${readIngredientsError?.message ?? 'missing results'}`)
  const ingredientIdByName = new Map(storedIngredients.map((ingredient) => [ingredient.name, ingredient.id]))
  const recipeIds = storedRecipes.map((recipe) => recipe.id)
  const { error: deleteIngredientsError } = await db.from('recipe_ingredients').delete().in('recipe_id', recipeIds)
  if (deleteIngredientsError) throw new Error(`ingredient links delete: ${deleteIngredientsError.message}`)
  const ingredientLinks = new Map<string, IngredientRow>()
  for (const item of prepared) for (const ingredient of item.ingredients) {
    const row: IngredientRow = { recipe_id: item.recipeId, ingredient_id: ingredientIdByName.get(ingredient.name)!, ...parseMeasure(ingredient.measure), raw_text: `${ingredient.measure} ${ingredient.name}`.trim() }
    ingredientLinks.set(`${row.recipe_id}:${row.ingredient_id}`, row)
  }
  if (ingredientLinks.size) {
    const { error } = await db.from('recipe_ingredients').insert([...ingredientLinks.values()])
    if (error) throw new Error(`ingredient links: ${error.message}`)
  }
  const tagNames = [...new Set(prepared.flatMap((item) => tagsFor(item.meal, item.ingredients.map((ingredient) => ingredient.name))))]
  const { error: tagsError } = await db.from('tags').upsert(tagNames.map((name) => ({ name })), { onConflict: 'name', ignoreDuplicates: true })
  if (tagsError) throw new Error(`tags: ${tagsError.message}`)
  const { data: storedTags, error: readTagsError } = await db.from('tags').select('id, name').in('name', tagNames)
  if (readTagsError || !storedTags) throw new Error(`tags read: ${readTagsError?.message ?? 'missing results'}`)
  const tagIdByName = new Map(storedTags.map((tag) => [tag.name, tag.id]))
  const { error: deleteTagsError } = await db.from('recipe_tags').delete().in('recipe_id', recipeIds)
  if (deleteTagsError) throw new Error(`tag links delete: ${deleteTagsError.message}`)
  const tagLinks = new Map<string, { recipe_id: string; tag_id: string }>()
  for (const item of prepared) for (const name of tagsFor(item.meal, item.ingredients.map((ingredient) => ingredient.name))) {
    const tagId = tagIdByName.get(name)!
    tagLinks.set(`${item.recipeId}:${tagId}`, { recipe_id: item.recipeId, tag_id: tagId })
  }
  if (tagLinks.size) {
    const { error } = await db.from('recipe_tags').insert([...tagLinks.values()])
    if (error) throw new Error(`tag links: ${error.message}`)
  }
  return { imported: uniqueMeals.length, skipped: meals.length - uniqueMeals.length }
}

Deno.serve(async () => {
  const apiKey = Deno.env.get('THEMEALDB_API_KEY')
  const url = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!apiKey || !url || !serviceRole) return Response.json({ error: 'Missing required secret' }, { status: 500 })
  const db = createClient(url, serviceRole)
  const summary = { fetched: 0, imported: 0, skipped: 0, failed: 0 }
  for (const letter of 'abcdefghijklmnopqrstuvwxyz') {
    try {
      const response = await fetch(`https://www.themealdb.com/api/json/v1/${apiKey}/search.php?f=${letter}`)
      if (!response.ok) throw new Error(`TheMealDB returned ${response.status}`)
      const { meals } = await response.json() as { meals: Meal[] | null }
      summary.fetched += (meals ?? []).length
      const result = await importMeals(db, meals ?? [])
      summary.imported += result.imported; summary.skipped += result.skipped
    } catch (error) { console.error(`Sync ${letter} failed`, error); summary.failed++ }
  }
  return Response.json(summary, { status: summary.failed ? 207 : 200 })
})
