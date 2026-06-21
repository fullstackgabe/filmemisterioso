$(document).ready(function () {
    let moviesPromise = null;

    function loadMovies() {
        if (!moviesPromise) {
            moviesPromise = $.getJSON('movies.json');
        }
        return moviesPromise;
    }

    function updateGenreAvailability() {
        const stream = $('input[name="stream"]:checked').val();

        loadMovies().done(function (movies) {
            const available = new Set();
            movies.forEach(function (m) {
                if (m.streams.includes(stream)) {
                    m.genre_ids.forEach(function (id) { available.add(id); });
                }
            });

            $('.form-check-input-genre').each(function () {
                const $input = $(this);
                const id = parseInt($input.val(), 10);
                const $wrapper = $input.closest('.form-check-genre');
                const ok = available.has(id);
                $input.prop('disabled', !ok);
                $wrapper.toggleClass('genre-disabled', !ok);
            });

            const $checked = $('input[name="genre"]:checked');
            if (!$checked.length || $checked.prop('disabled')) {
                $('.form-check-input-genre:not(:disabled)').first().prop('checked', true);
            }
        });
    }

    $('input[name="stream"]').on('change', updateGenreAvailability);
    updateGenreAvailability();

    $('#myForm').on('submit', function (event) {
        event.preventDefault();

        const $btn = $(this).find('button[type="submit"]');
        const originalText = $btn.html();

        $btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Sorteando...');

        const stream = $('input[name="stream"]:checked').val();
        const genre = parseInt($('input[name="genre"]:checked').val(), 10);

        loadMovies()
            .done(function (movies) {
                const matches = movies.filter(function (m) {
                    return m.streams.includes(stream) && m.genre_ids.includes(genre);
                });

                if (!matches.length) {
                    return;
                }

                const randomMovie = matches[Math.floor(Math.random() * matches.length)];
                displayMovieDetails(randomMovie);
            })
            .fail(function () {
                alert('Erro ao carregar a lista de filmes (movies.json).');
            })
            .always(function () {
                $btn.prop('disabled', false).html(originalText);
            });
    });

    function displayMovieDetails(movie) {
        $('#movieOriginalTitle').text('Título Original - ' + movie.original_title);
        $('#movieTitle').text(movie.title);
        $('#movieReleaseDate').text(movie.release_date ? new Date(movie.release_date).getFullYear() : '');

        const posterUrl = movie.poster_path
            ? `https://image.tmdb.org/t/p/w342${movie.poster_path}`
            : 'src/poster-fallback.jpg';
        $('#moviePoster').attr('src', posterUrl);

        $('#movieOverview').text(movie.overview || 'Sinopse não disponível.');

        $('#movieRating').text(Number(movie.vote_average).toFixed(1).replace('.', ','));

        $('#movieGenres').empty();
        movie.genre_ids.forEach(id => {
            const name = getGenreName(id);
            if (!name) return;
            const genreTag = $('<span>')
                .addClass('badge genre-tag')
                .text(name);
            $('#movieGenres').append(genreTag);
        });

        const modal = new bootstrap.Modal(document.getElementById('movieModal'));
        modal.show();
    }

    function getGenreName(id) {
        const genres = {
            28: 'Ação', 12: 'Aventura', 16: 'Animação', 35: 'Comédia',
            80: 'Crime', 99: 'Documentário', 18: 'Drama', 10751: 'Família',
            14: 'Fantasia', 36: 'História', 27: 'Terror', 10402: 'Musical',
            9648: 'Suspense', 10749: 'Romance', 878: 'Ficção Científica',
            10770: 'Cinema TV', 53: 'Thriller', 10752: 'Guerra', 37: 'Faroeste'
        };
        return genres[id] || '';
    }
});
