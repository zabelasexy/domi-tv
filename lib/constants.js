export const STATUS = [
  { k: "assistindo", label: "Assistindo" },
  { k: "finalizada", label: "Finalizada" },
  { k: "quero", label: "Quero ver" },
  { k: "geladeira", label: "Na geladeira" },
  { k: "abandonada", label: "Abandonada" },
];
export const STATUS_LABEL = Object.fromEntries(STATUS.map((s) => [s.k, s.label]));

export const GENRES = {
  10759: "Ação e Aventura", 16: "Animação", 35: "Comédia", 80: "Crime", 99: "Documentário",
  18: "Drama", 10751: "Família", 10762: "Infantil", 9648: "Mistério", 10763: "Notícias",
  10764: "Reality", 10765: "Sci-Fi e Fantasia", 10766: "Novela", 10767: "Talk show",
  10768: "Guerra e Política", 37: "Faroeste",
};

export const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export const today = () => new Date().toISOString().slice(0, 10);
