const movieList = {
    movies: [
        { id: 7, name: "Законопослушный гражданин", image: "./Movie images/7.webp" },
        { id: 8, name: "Дом", image: "./Movie images/8.jpg" },
        { id: 9, name: "Голодные игры", image: "./Movie images/9.jpg" },
        { id: 10, name: "Мандарины", image: "./Movie images/10.jpg" },
        { id: 11, name: "Отец солдата", image: "./Movie images/11.jpg" },
        { id: 12, name: "Фокус", image: "./Movie images/12.jpg" },
        { id: 13, name: "Однажды в Америке", image: "./Movie images/13.jpg" },
        { id: 14, name: "Брюс Всемогущий", image: "./Movie images/14.jpg" },
        { id: 15, name: "Зима в огне", image: "./Movie images/15.jpg" },
        { id: 16, name: "Схватка", image: "./Movie images/16.jpg" },
        { id: 17, name: "Адвокат дьявола", image: "./Movie images/17.jpg" },
        { id: 18, name: "Безумно влюблённый", image: "./Movie images/18.jpg" },
        { id: 19, name: "Лицо со шрамом", image: "./Movie images/19.jpg" },
        { id: 20, name: "Бойцовский клуб", image: "./Movie images/20.jpg" },
        { id: 21, name: "Крёстный Отец 1", image: "./Movie images/21.jpg" },
        { id: 22, name: "Крёстный Отец 2", image: "./Movie images/22.jpg" },
        { id: 23, name: "Крёстный Отец 3", image: "./Movie images/23.jpg" },
        { id: 24, name: "Укрощение строптивого", image: "./Movie images/24.jpg" },
        { id: 25, name: "Блеф", image: "./Movie images/25.jpg" },
        { id: 26, name: "Нокдаун", image: "./Movie images/26.jpg" },
        { id: 27, name: "Гладиатор", image: "./Movie images/27.jpg" },
        { id: 28, name: "Последний самурай", image: "./Movie images/28.jpg" },
        { id: 29, name: "Грань будущего", image: "./Movie images/29.jpg" },
        { id: 30, name: "Обливион", image: "./Movie images/30.jpg" }
    ],
    series: [
        { id: 31, name: "Викинги", image: "./Series images/31.webp" },
    ],
    cartoons: [
        { id: 1, name: "Неисправимый Рон", image: "./Movie images/ron.jpg" },
        { id: 2, name: "Как приручить дракона", image: "./Movie images/drakon1.jpg" },
        { id: 3, name: "Как приручить дракона 2", image: "./Movie images/drakon2.webp" },
        { id: 4, name: "Как приручить дракона 3", image: "./Movie images/drakon3.webp" },
        { id: 5, name: "В поисках Немо", image: "./Movie images/nemo.jpg" },
        { id: 6, name: "В поисках Дори", image: "./Movie images/dori.jpg" }
    ]
};

// Функция для перемешивания массива
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Функция для отображения галереи
function renderGallery(category) {
    const gallery = document.getElementById('movieGallery');
    gallery.innerHTML = '';

    const shuffledMovies = shuffleArray(movieList[category]);

    shuffledMovies.forEach(movie => {
        const movieItem = document.createElement('div');
        movieItem.className = 'gallery-item';
        movieItem.innerHTML = `
            <img src="${movie.image}" alt="${movie.name}">
            <h3>${movie.name}</h3>
        `;
        gallery.appendChild(movieItem);
    });

    document.getElementById('categorySection').style.display = 'none';
    document.getElementById('moviesSection').style.display = 'block';
}

// Добавление событий на категории
document.getElementById('moviesCategory').addEventListener('click', () => {
    renderGallery('movies');
});

document.getElementById('seriesCategory').addEventListener('click', () => {
    renderGallery('series');
});

document.getElementById('cartoonsCategory').addEventListener('click', () => {
    renderGallery('cartoons');
});

