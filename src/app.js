const API_ILLUVIUM = 'https://api.illuvium-game.io/gamedata/assets/offchain/illuvials'
// illuvials queimados
const burnTraits = {
    "burned": true,
    "level": 0,
    "xp": 0,
    "requiredXP": 0,
    "baseStats": {
        "AttackDamage": 0,
        "AttackSpeed": 0,
        "AttackRange": 0,
        "Health": 0,
        "MovementSpeed": 0,
        "OmegaPower": 0,
        "EnergyResist": 0,
        "PhysicalResist": 0,
        "CritChance": 0,
        "CritAmp": 0,
        "DodgeChance": 0
    },
    "traits": {
        "AttackDamage": 0,
        "AttackSpeed": 0,
        "Health": 0,
        "MovementSpeed": 0,
        "OmegaPower": 0,
        "Resistance": 0
    }
}

const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const async = require('async');

const app = express();

// Configurar CORS
app.use(cors());

// Para interpretar JSON no corpo da requisição
app.use(express.json())

// Configurar EJS como template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Rotas
app.get('/', (req, res) => {
    res.render('index');
});

/*
app.post('/api', async (req, res) => {
    const { tokens_id } = req.body;

    try {
        // Usando Promise.all para lidar com múltiplas requisições assíncronas
        const result = await Promise.all(
            tokens_id.map(async (id) => {
                try {
                    const response = await axios.get(`${API_ILLUVIUM}/${id}`)
                    return await response.data
                } catch (error) {
                    console.log(error)
                    return burnTraits
                }
            })
        );
        res.json(result);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ error: 'Ocorreu um erro ao processar a requisição.' });
    }

});
*/
app.post('/api', async (req, res) => {
    const { tokens_id } = req.body;

    try {
        const result = await fetchMultipleRequests(tokens_id.length, 3, 1, tokens_id)
            .then(res => {
                return res
            })
            .catch(error => {
                console.log(error)
            })

        res.json(result);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ error: 'Ocorreu um erro ao processar a requisição.' });
    }
});

// Função principal que gerencia as requisições
async function fetchMultipleRequests(numRequests, retries = 3, concurrencyLimit = 5, tokens_id) {
    const urls = generateUrls(numRequests); // Gera as URLs dinamicamente
    const results = [];

    // Configura a fila com o limite de concorrência
    const queue = async.queue(async (task, callback) => {
        try {
            const response = await axios.get(task.url, { timeout: 15000 }); // Timeout de 10 segundos
            task.onSuccess(response.data); // Sucesso
        } catch (error) {
            task.onError(error); // Falha
        }
    }, concurrencyLimit); // Limite de concorrência passado na função

    // Handler quando todas as tarefas forem concluídas
    queue.drain(() => {
        console.log('Todas as requisições foram processadas.');
    });

    // Função para aguardar um tempo específico (ms)
    function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Função para adicionar uma tarefa à fila
    function addTask(url) {
        return new Promise((resolve, reject) => {
            queue.push({
                url,
                onSuccess: resolve,
                onError: reject
            }, (err) => {
                if (err) {
                    console.error(`Erro ao processar a URL ${url}:`, err.message);
                }
            });
        });
    }

    // Função para adicionar uma tarefa com retry
    async function addTaskWithRetry(url, retries = 3, delay = 10000) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const data = await addTask(url);
                return data; // Sucesso
            } catch (error) {
                console.warn(`Tentativa ${attempt} para ${url} falhou: ${error.message}`);
                if (attempt < retries) {
                    await wait(delay);
                    delay *= 2; // Exponential backoff
                } else {
                    return burnTraits
                    throw new Error(`Todas as ${retries} tentativas para ${url} falharam.`);
                }
            }
        }
    }

    // Gera URLs dinamicamente com base na quantidade de requisições
    function generateUrls(num) {
        const baseUrl = API_ILLUVIUM;
        return Array.from({ length: num }, (_, i) => `${baseUrl}/${tokens_id[i]}`);
    }

    // Processa todas as requisições
    for (const url of urls) {
        try {
            const data = await addTaskWithRetry(url, retries);
            results.push({ ...data }); // Ajuste conforme a estrutura de resposta da API
            console.log(`Dados recebidos de ${url}: ${data} itens.`);
        } catch (error) {
            console.error(`Falha ao obter dados de ${url}:`, error.message);
        }
    }

    console.log('Total de resultados obtidos:', results.length);
    return results; // Retorna os resultados finais
}


module.exports = app;
