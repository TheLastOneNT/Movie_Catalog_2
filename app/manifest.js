export const dynamic = "force-static";

export default function manifest() {
  return {
    name: "Movie Catalog",
    short_name: "Movie Catalog",
    description: "Семейная коллекция кино",
    start_url: "/",
    scope: "/",
    id: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    background_color: "#0b0b0d",
    theme_color: "#0b0b0d",
    icons: [
      {
        src: "/app-icon-v2.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
