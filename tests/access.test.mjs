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

test("keeps family catalog private without a session", async () => {
  const response = await worker.fetch(
    new Request("https://movies.example.test/api/catalog"),
    createEnvironment(),
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Authentication required." });
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

test("allows authenticated family catalog reads", async () => {
  const { createHash } = await import("node:crypto");
  const token = createHash("sha256").update("movie-catalog-session:test-family-key").digest("hex");
  const response = await worker.fetch(
    new Request("https://movies.example.test/api/catalog", {
      headers: { cookie: `movie_catalog_session=${token}` },
    }),
    createEnvironment(),
  );
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).movies, []);
});
