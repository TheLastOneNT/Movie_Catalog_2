function showMovies(category) {
    localStorage.setItem('selectedCategory', category);
    window.location.href = "movies.html";
}

function displayMovies() {
    const selectedCategory = localStorage.getItem('selectedCategory');
    if (selectedCategory) {
        const movieGallery = document.getElementById('movieGallery');
        movieGallery.innerHTML = ''; // Очистка галереи

        movieList[selectedCategory].forEach(movie => {
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

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('moviesSection')) {
        displayMovies();
    }
});
