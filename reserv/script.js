const movieList = [
    {
        id: 1,
        name: "Неисправимый Рон",
        genre: ["Cartoon"],
        image: "./Movie images/ron.jpg",
    },
    {
        id: 2,
        name: "Как приручить дракона",
        genre: ["Cartoon"],
        image: "./Movie images/drakon1.jpg",
    },
    {
        id: 3,
        name: "Как приручить дракона 2",
        genre: ["Cartoon"],
        image: "./Movie images/drakon2.webp",
    },
    {
        id: 4,
        name: "Как приручить дракона 3",
        genre: ["Cartoon"],
        image: "./Movie images/drakon3.webp",
    },
    {
        id: 5,
        name: "В поисках Немо",
        genre: ["Cartoon"],
        image: "./Movie images/nemo.jpg",
    },
    {
        id: 6,
        name: "В поисках Дори",
        genre: ["Cartoon"],
        image: "./Movie images/dori.jpg",
    },
    {
        id: 7,
        name: "Законопослушный гражданин",
        genre: ["Action", "Drama"],
        image: "./Movie images/7.webp",
    },
    {
        id: 8,
        name: "Дом",
        genre: ["Documentary"],
        image: "./Movie images/8.jpg",
    },
    {
        id: 9,
        name: "Голодные игры",
        genre: ["Action", "Fantasy"],
        image: "./Movie images/9.jpg",
    },
    {
        id: 10,
        name: "Мандарины",
        genre: ["Drama", "Historical"],
        image: "./Movie images/10.jpg",
    },
    {
        id: 11,
        name: "Отец солдата",
        genre: ["Drama", "Historical"],
        image: "./Movie images/11.jpg",
    },
    {
        id: 12,
        name: "Фокус",
        genre: ["Drama"],
        image: "./Movie images/12.jpg",
    },
    {
        id: 13,
        name: "Однажды в Америке",
        genre: ["Action"],
        image: "./Movie images/13.jpg",
    },
    {
        id: 14,
        name: "Брюс Всемогущий",
        genre: ["Comedy"],
        image: "./Movie images/14.jpg",
    },
    {
        id: 15,
        name: "Зима в огне",
        genre: ["Documentary", "Historical"],
        image: "./Movie images/15.jpg",
    },
    {
        id: 16,
        name: "Схватка",
        genre: ["Action", "Drama"],
        image: "./Movie images/16.jpg",
    },
    {
        id: 17,
        name: "Адвокат дьявола",
        genre: ["Drama", "Christian"],
        image: "./Movie images/17.jpg",
    },
    {
        id: 18,
        name: "Безумно влюблённый",
        genre: ["Comedy"],
        image: "./Movie images/18.jpg",
    },
    {
        id: 19,
        name: "Лицо со шрамом",
        genre: ["Action"],
        image: "./Movie images/19.jpg",
    },
    {
        id: 20,
        name: "Бойцовский клуб",
        genre: ["Action", "Drama"],
        image: "./Movie images/20.jpg",
    },
    {
        id: 21,
        name: "Крёстный Отец 1",
        genre: ["Action", "Drama"],
        image: "./Movie images/21.jpg",
    },
    {
        id: 22,
        name: "Крёстный Отец 2",
        genre: ["Action", "Drama"],
        image: "./Movie images/22.jpg",
    },
    {
        id: 23,
        name: "Крёстный Отец 3",
        genre: ["Action", "Drama"],
        image: "./Movie images/23.jpg",
    },
    {
        id: 24,
        name: "Укрощение строптивого",
        genre: ["Comedy"],
        image: "./Movie images/24.jpg",
    },
    {
        id: 25,
        name: "Блеф",
        genre: ["Comedy"],
        image: "./Movie images/25.jpg",
    },
    {
        id: 26,
        name: "Нокдаун",
        genre: ["Drama"],
        image: "./Movie images/26.jpg",
    },
    {
        id: 27,
        name: "Гладиатор",
        genre: ["Drama"],
        image: "./Movie images/27.jpg",
    },
    {
        id: 28,
        name: "Последний самурай",
        genre: ["Drama"],
        image: "./Movie images/28.jpg",
    },
    {
        id: 29,
        name: "Грань будущего",
        genre: ["Action", "Drama"],
        image: "./Movie images/29.jpg",
    },
    {
        id: 30,
        name: "Обливион",
        genre: ["Action", "Drama"],
        image: "./Movie images/30.jpg",
    },
];

const gallery = document.getElementById('movieGallery');

// Clear existing gallery content
gallery.innerHTML = '';

movieList.forEach(movie => {
    const movieItem = document.createElement('div');
    movieItem.className = 'gallery-item';
    movieItem.innerHTML = `
        <img src="${movie.image}" alt="${movie.name}">
        <h3>${movie.name}</h3>
        <p>${movie.genre.join(', ')}</p>
    `;
    gallery.appendChild(movieItem);
});

// Navigation functionality
const moviesSection = document.getElementById('moviesSection');

document.getElementById('moviesLink').addEventListener('click', () => {
    moviesSection.scrollIntoView({ behavior: 'smooth' });
});

document.getElementById('genresLink').addEventListener('click', () => {
    moviesSection.scrollIntoView({ behavior: 'smooth' });
});

document.getElementById('homeLink').addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});
