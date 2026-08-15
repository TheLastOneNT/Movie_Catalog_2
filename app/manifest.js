export const dynamic = "force-static";

export default function manifest() {
  return {
    name: "Movie Catalog",
    short_name: "Movies",
    description: "Семейная коллекция кино",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0b0d",
    theme_color: "#0b0b0d",
    icons: [
      {
        src: "/film-reel.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
