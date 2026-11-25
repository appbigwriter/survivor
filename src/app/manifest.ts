import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Survivor",
    short_name: "Survivor",
    description: "Acompanhamento de alimentação, caminhada e treino.",
    start_url: "/hoje",
    display: "standalone",
    background_color: "#f6f7f4",
    theme_color: "#1f6f4a",
    lang: "pt-BR",
  };
}
