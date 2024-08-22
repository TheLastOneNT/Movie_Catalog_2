function showMovies(category) {
    localStorage.setItem('selectedCategory', category);
    window.location.href = "movies.html";
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function displayMovies() {
    const selectedCategory = localStorage.getItem('selectedCategory');
    if (selectedCategory) {
        const movieGallery = document.getElementById('movieGallery');
        movieGallery.innerHTML = ''; // Очистка галереи

        // Перемешиваем массив фильмов перед отображением
        const shuffledMovies = shuffleArray([...movieList[selectedCategory]]);

        shuffledMovies.forEach(movie => {
            const movieItem = document.createElement('div');
            movieItem.className = 'gallery-item';
            movieItem.innerHTML = `
                <img src="${movie.image}" alt="${movie.name}">
                <h3>${movie.name}</h3>
            `;
            movieGallery.appendChild(movieItem);
        });

        // Устанавливаем сетку для отображения двух постеров в ряду
        movieGallery.style.display = 'grid';
        movieGallery.style.gridTemplateColumns = 'repeat(2, 1fr)'; // Задаем два постера в ряду
        movieGallery.style.gap = '15px'; // Отступы между постерами
    }
}

function goHome() {
    window.location.href = "index.html";
}

function updateMovieCount() {
    const totalMovies = Object.values(movieList).flat().length;
    document.getElementById('movieCount').textContent = `В базе всего ${totalMovies} фильмов`;
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('moviesSection')) {
        displayMovies();
    }
    updateMovieCount(); // Обновляем количество фильмов в футере
});
