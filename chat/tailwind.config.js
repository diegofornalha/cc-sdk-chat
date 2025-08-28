/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        notion: {
          text: "rgb(55, 53, 47)",
          textLight: "rgba(55, 53, 47, 0.65)",
          border: "rgba(55, 53, 47, 0.16)",
          link: "rgb(35, 131, 226)",
          code: "#EB5757",
          background: "rgb(247, 246, 243)",
        },
      },
    },
  },
  plugins: [],
};
