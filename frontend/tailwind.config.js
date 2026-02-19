
/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: '#252525',
                foreground: '#D1D9E0',
                accent: '#8B008B',
                card: '#1D1E1F',
                'card-border': '#333333',
            },
            spacing: {
                'page': '32px',
            }
        },
    },
    plugins: [],
}
