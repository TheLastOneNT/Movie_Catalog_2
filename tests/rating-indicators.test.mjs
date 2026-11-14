import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const page = await readFile(new URL("../app/page.js", import.meta.url),"utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url),"utf8");
test("catalog displays ratings or watched mark without interactive overlays",()=>{
 assert.match(page,/className=\{rating \? "cardRatingBadge" : "cardRatingBadge viewed"\}/);
 assert.doesNotMatch(page,/className="cardQuickActions"/);
 assert.doesNotMatch(page,/className=\{personal\.isFavorite \? "favoriteButton/);
 assert.match(css,/\.cardRatingBadge \{[^\n]*pointer-events: none;/);
});
test("list cards display rating followed by details",()=>{
 assert.match(page,/rating \? "listRatingLabel" : "listRatingLabel viewed"/);
 assert.match(page,/className="moreLink cardDetailsButton"/);
 assert.match(css,/\.movieCardList \.cardBottom \{ display: flex; flex-direction: column;/);
});
test("favorite features are hidden without data deletion",()=>{
 assert.doesNotMatch(page,/<option value="favorites">/);
 assert.doesNotMatch(page, /"modalFavorite active"/);
 assert.doesNotMatch(page,/favoriteCount/);
 assert.doesNotMatch(page,/fiveStarCount/);
});
test("ratings cannot be manually overridden in film detail",()=>{
 assert.match(page,/className="seriesAverageRating"/);
 assert.doesNotMatch(page,/onChange=\{\(rating\) => updateSharedRating\(selected\.id,rating\)\}/);
});
