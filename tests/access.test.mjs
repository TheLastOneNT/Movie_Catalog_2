import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/index.js";

function createEnvironment() {
  return {
    ACCESS_KEY: "test-family-key",
    DB: {
      prepare() {
        return {
          async all() {
            return { results: [] };
          },
        };
      },
    },
    ASSETS: {
      fetch() {
        return new Response("asset");
      },
    },
  };
}

test("allows public catalog reads without a session", async () => {
  const response = await worker.fetch(
    new Request("https://movies.example.test/api/catalog"),
    createEnvironment(),
  );

  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).movies, []);
});

test("requires a session for catalog changes", async () => {
  const response = await worker.fetch(
    new Request("https://movies.example.test/api/movies/1/progress", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rating: 5 }),
    }),
    createEnvironment(),
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Authentication required." });
});

test("keeps backup exports private", async () => {
  const response = await worker.fetch(
    new Request("https://movies.example.test/api/export"),
    createEnvironment(),
  );

  assert.equal(response.status, 401);
});
