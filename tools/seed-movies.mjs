import { writeFile, readFile } from 'node:fs/promises';

let API_KEY = process.env.API_KEY ? process.env.API_KEY.trim() : null;
let BASE_URL = process.env.BASE_URL ? process.env.BASE_URL.trim() : null;

if (!API_KEY || !BASE_URL) {
    try {
        const env = await readFile(new URL('../.env', import.meta.url), 'utf8');
        const pick = (name) => {
            const m = env.match(new RegExp(`^\\s*${name}\\s*=\\s*(.*)$`, 'm'));
            return m ? m[1].trim().replace(/^["']|["']$/g, '') : null;
        };
        API_KEY = API_KEY || pick('API_KEY');
        BASE_URL = BASE_URL || pick('BASE_URL');
    } catch { /* noop */ }
}

BASE_URL = (BASE_URL || 'https://api.themoviedb.org/3').replace(/\/$/, '');

if (!API_KEY) {
    console.error('Erro: defina a API_KEY do TMDB (variavel de ambiente ou arquivo .env).');
    process.exit(1);
}

const STREAMS = { '8': 'Netflix', '119': 'Amazon Prime', '1899': 'HBO Max', '337': 'Disney+', '350': 'Apple TV+' };
const GENRES = [28, 12, 16, 35, 80, 10749, 878, 18, 14, 10752, 27, 9648];
const PAGES_PER_QUERY = 5;
const WITHOUT_KEYWORDS = ['9715', '210024'];
const DEFAULT_MIN_VOTES = 1000;
const MIN_VOTES_BY_STREAM = { '350': 300 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function buildUrl(stream, genre, page) {
    const p = new URLSearchParams({
        api_key: API_KEY,
        with_original_language: 'en',
        language: 'pt-BR',
        watch_region: 'BR',
        region: 'BR',
        with_watch_providers: stream,
        with_genres: String(genre),
        'vote_average.gte': '7.0',
        'vote_average.lte': '9.9',
        'vote_count.gte': String(MIN_VOTES_BY_STREAM[stream] || DEFAULT_MIN_VOTES),
        'with_runtime.gte': '90',
        without_keywords: WITHOUT_KEYWORDS.join(','),
        page: String(page),
    });
    if (genre !== 16) p.set('without_genres', '16');
    return `${BASE_URL}/discover/movie?${p.toString()}`;
}

const byId = new Map();

for (const stream of Object.keys(STREAMS)) {
    for (const genre of GENRES) {
        let totalPages = PAGES_PER_QUERY;
        for (let page = 1; page <= PAGES_PER_QUERY && page <= totalPages; page++) {
            let data;
            try {
                const res = await fetch(buildUrl(stream, genre, page));
                if (!res.ok) {
                    console.warn(`  falha ${STREAMS[stream]}/${genre} p${page}: HTTP ${res.status}`);
                    break;
                }
                data = await res.json();
            } catch (e) {
                console.warn(`  erro de rede ${STREAMS[stream]}/${genre} p${page}: ${e.message}`);
                break;
            }

            totalPages = Math.min(data.total_pages || 1, PAGES_PER_QUERY);

            for (const m of data.results || []) {
                if (!m.poster_path) continue;
                let entry = byId.get(m.id);
                if (!entry) {
                    entry = {
                        id: m.id,
                        title: m.title,
                        original_title: m.original_title,
                        poster_path: m.poster_path,
                        overview: m.overview,
                        vote_average: m.vote_average,
                        release_date: m.release_date,
                        genre_ids: [...(m.genre_ids || [])],
                        streams: [],
                    };
                    byId.set(m.id, entry);
                }
                if (!entry.streams.includes(stream)) entry.streams.push(stream);
                for (const g of m.genre_ids || []) {
                    if (!entry.genre_ids.includes(g)) entry.genre_ids.push(g);
                }
            }
            await sleep(50);
        }
        console.log(`${STREAMS[stream]} / genero ${genre}  ->  ${byId.size} filmes acumulados`);
    }
}

const movies = [...byId.values()].sort((a, b) => b.vote_average - a.vote_average);
await writeFile(new URL('../movies.json', import.meta.url), JSON.stringify(movies, null, 2) + '\n');

console.log(`\nPronto! ${movies.length} filmes salvos em movies.json`);
console.log('Lista atualizada: novos adicionados, streams corrigidos, indisponiveis removidos.');
console.log('Para publicar: git add movies.json && git commit -m "Atualiza filmes" && git push');
