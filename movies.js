// movies.js

const movieList = {
    movies: [
        { id: 7, name: "Законопослушный гражданин", image: "./Movie images/7.webp" },
        { id: 9, name: "Голодные игры", image: "./Movie images/9.jpg" },
        { id: 10, name: "Мандарины", image: "./Movie images/10.jpg" },
        { id: 11, name: "Отец солдата", image: "./Movie images/11.jpg" },
        { id: 12, name: "Фокус", image: "./Movie images/12.jpg" },
        { id: 13, name: "Однажды в Америке", image: "./Movie images/13.jpg" },
        { id: 14, name: "Брюс Всемогущий", image: "./Movie images/14.jpg" },
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
        { id: 30, name: "Обливион", image: "./Movie images/30.jpg" },
            { id: 32, name: "Начало", image: "./Movie images/32.jpg" },
            { id: 33, name: "Интерстеллар", image: "./Movie images/33.jpg" },
            { id: 34, name: "Пианист", image: "./Movie images/34.jpg" },
            { id: 35, name: "Леон", image: "./Movie images/35.webp" },
            { id: 36, name: "Гладиатор", image: "./Movie images/36.webp" },
            { id: 37, name: "Отступники", image: "./Movie images/37.jpg" },
            { id: 38, name: "1 + 1", image: "./Movie images/38.jpg" },
            { id: 40, name: "Шоу Трумана", image: "./Movie images/39.jpg" },
            { id: 41, name: "12 лет рабства", image: "./Movie images/40.jpg" },
            { id: 42, name: "По соображениям совести", image: "./Movie images/41.jpg" },
            { id: 43, name: "Запах женщины", image: "./Movie images/42.jpg" },
            { id: 44, name: "Путь Карлито", image: "./Movie images/43.jpg" },
            { id: 45, name: "Одиннадцать друзей Оушена", image: "./Movie images/44.jpg" },
            { id: 46, name: "Двенадцать друзей Оушена", image: "./Movie images/45.webp" },
            { id: 47, name: "Тринадцать друзей Оушена", image: "./Movie images/46.jpg" },
            { id: 48, name: "Джанго освобождённый", image: "./Movie images/47.jpg" },
            { id: 49, name: "Всегда говори «да»", image: "./Movie images/48.jpg" },
            { id: 50, name: "Лжец, лжец", image: "./Movie images/49.webp" },
            { id: 51, name: "Эйс Вентура: Розыск домашних животных", image: "./Movie images/50.jpg" },
            { id: 52, name: "Пингвины мистера Поппера", image: "./Movie images/51.jpg" },
            { id: 53, name: "Последний самурай", image: "./Movie images/52.jpg" },
            { id: 54, name: "Гарри Поттер и философский камень", image: "./Movie images/53.jpg" },
            { id: 55, name: "Гарри Поттер и Тайная комната", image: "./Movie images/54.jpg" },
            { id: 56, name: "Гарри Поттер и узник Азкабана", image: "./Movie images/55.jpg" },
            { id: 57, name: "Гарри Поттер и Кубок огня", image: "./Movie images/56.jpg" },
            { id: 58, name: "Гарри Поттер и Орден Феникса", image: "./Movie images/57.jpg" },
            { id: 59, name: "Гарри Поттер и Принц-полукровка", image: "./Movie images/58.jpg" },
            { id: 60, name: "Гарри Поттер и Дары Смерти. Часть 1", image: "./Movie images/59.jpg" },
            { id: 61, name: "Гарри Поттер и Дары Смерти. Часть 2", image: "./Movie images/60.jpg" },
            { id: 62, name: "Каратэ-пацан", image: "./Movie images/61.jpg" },
            { id: 63, name: "Час пик", image: "./Movie images/62.jpg" },
            { id: 64, name: "Час пик 2", image: "./Movie images/63.jpg" },
            { id: 65, name: "Час пик 3", image: "./Movie images/64.jpg" },
            { id: 66, name: "Дом большой мамочки", image: "./Movie images/65.jpg" },
            { id: 67, name: "Дом большой мамочки 2", image: "./Movie images/66.jpg" },
            { id: 68, name: "Дом большой мамочки 3", image: "./Movie images/67.jpg" },
            { id: 69, name: "Нечего терять", image: "./Movie images/68.jpg" },
            { id: 70, name: "Бриллиантовый полицейский", image: "./Movie images/69.jpg" },
            { id: 71, name: "Плохие парни", image: "./Movie images/70.jpg" },
            { id: 72, name: "Плохие парни 2", image: "./Movie images/71.jpg" },
            { id: 73, name: "Плохие парни навсегда", image: "./Movie images/72.jpg" },
            { id: 74, name: "В погоне за счастьем", image: "./Movie images/73.jpg" },
            { id: 75, name: "Я — легенда", image: "./Movie images/74.jpg" },
            { id: 76, name: "Освобождение", image: "./Movie images/75.jpg" },
            { id: 77, name: "300 спартанцев", image: "./Movie images/76.jpg" },
            { id: 78, name: "300 спартанцев: Расцвет империи", image: "./Movie images/77.jpg" },
            { id: 79, name: "Мачо и ботан", image: "./Movie images/78.jpg" },
            { id: 80, name: "Мачо и ботан 2", image: "./Movie images/79.jpg" },
            { id: 81, name: "Астерикс и Обеликс: Миссия «Клеопатра»", image: "./Movie images/80.jpg" },
            { id: 82, name: "Астерикс на Олимпийских играх", image: "./Movie images/81.jpg" }
        ],
        
    documentaries: [
        { id: 8, name: "Дом", image: "./Movie images/8.jpg" },
        { id: 15, name: "Зима в огне", image: "./Movie images/15.jpg" },
    ],
    series: [
        { id: 31, name: "Викинги", image: "./Movie images/31.webp" },
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
