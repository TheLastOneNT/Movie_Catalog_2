const movieList = {
    movies: [
        { id: 1, name: "Фильм 1", image: "./Movie images/1.jpg" },
        { id: 2, name: "Фильм 2", image: "./Movie images/2.jpg" },
        // Добавьте больше фильмов сюда...
    ],
    documentaries: [
        { id: 1, name: "Документалка 1", image: "./Documentary images/1.jpg" },
        { id: 2, name: "Документалка 2", image: "./Documentary images/2.jpg" },
        // Добавьте больше документалок сюда...
    ],
    series: [
        { id: 1, name: "Сериал 1", image: "./Series images/1.jpg" },
        { id: 2, name: "Сериал 2", image: "./Series images/2.jpg" },
        // Добавьте больше сериалов сюда...
    ],
    cartoons: [
        { id: 1, name: "Мультфильм 1", image: "./Cartoon images/1.jpg" },
        { id: 2, name: "Мультфильм 2", image: "./Cartoon images/2.jpg" },
        // Добавьте больше мультфильмов сюда...
    ]
};

const categorySection = document.getElementById('categorySection');
const moviesSection = document.getElementById('moviesSection');
const movieGallery = document.getElementById('movieGallery');

function showMovies(category) {
    movieGallery.innerHTML = ''; // Очистка галереи

    movieList[category].forEach(movie => {
        const movieItem = document.createElement('div');
        movieItem.className = 'gallery-item';
        movieItem.innerHTML = `
            <img src="${movie.image}" alt="${movie.name}">
            <h3>${movie.name}</h3>
        `;
        movieGallery.appendChild(movieItem);
    });

    categorySection.style.display = 'none'; // Скрыть секцию категорий
    moviesSection.style.display = 'block'; // Показать секцию фильмов
}

// Добавляем обработчики событий для категорий
document.getElementById('moviesCategory').addEventListener('click', () => showMovies('movies'));
document.getElementById('documentariesCategory').addEventListener('click', () => showMovies('documentaries'));
document.getElementById('seriesCategory').addEventListener('click', () => showMovies('series'));
document.getElementById('cartoonsCategory').addEventListener('click', () => showMovies('cartoons'));

// Возврат на главную страницу при клике на хедер
document.getElementById('homeLink').addEventListener('click', () => {
    categorySection.style.display = 'flex';
    moviesSection.style.display = 'none';
});
