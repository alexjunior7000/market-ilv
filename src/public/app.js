//app.js

const API_IMMUTABLE = 'https://api.x.immutable.com/v3/orders'
const API_ILLUVIUM = 'https://api.illuvium-game.io/gamedata/assets/offchain/illuvials'
const TOKEN_ADDRESS = '0x205634b541080afff3bbfe02dcc89f8fa8a1f1d4'

// Lista de illuvials (para futuros testes)
const illuvials = [
  { name: "Axon", class: "Empath", affinity: "Nature", stage: 1 },
  { name: "Atlas", class: "Bulwark", affinity: "Water", stage: 1 },
  { name: "Arlen", class: "Slayer", affinity: "Fire", stage: 2 },
  { name: "Vermillium", class: "Assassin", affinity: "Fire", stage: 3 },
  { name: "Seer", class: "Psion", affinity: "Air", stage: 2 },
];

// Lista de traits para os filtros e gráficos
const traitsList = [
  "Health",
  "AttackSpeed",
  "AttackDamage",
  "OmegaPower",
  "MovementSpeed",
  "Resistance",
];

// illuvials queimados
const burnTraits = {
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

// Inicializa DataTable
let dataTable;

// Data para carregar a
let originalData = [];

// Objeto global para rastrear instâncias dos gráficos
let chartInstances = {};

//
let lineChart;

$(document).ready(function () {
  // Gera os filtros dinamicamente
  generateFilters();

  // Inicializa DataTable
  initializeDataTable();

  renderLineChart(originalData)

  // Manipula o envio do formulário de busca
  $("#search-form").on("submit", function (e) {
    e.preventDefault();
    performSearch();
  });

  // Manipula mudanças nos filtros
  $("#filters-container select, #filter-finish").on("change", function () {
    applyFilters();
  });

  new bootstrap.Modal(document.getElementById('meuModal')).show();

});

// Função para renderizar o gráfico de linha
function renderLineChart(data) {
  const ctx = document.getElementById("line-chart").getContext("2d");

  if (lineChart) {
    lineChart.destroy(); // Destrói o gráfico anterior se existir
  }

  if (data.length == 0) return

  lineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(item => converterDataISOParaDiaMesAno(item.timestamp)).reverse(),
      datasets: [{
        label: '#',
        data: data.map(item => item.price).reverse(),
        borderWidth: 1
      }]
    },
    options: {
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

// Função para inicializar o DataTable (permanece o mesmo)
function initializeDataTable() {
  dataTable = $("#results-table").DataTable({
    columns: [
      {
        data: null,
        orderable: false,
        render: function (data, type, row, meta) {
          const canvasId = "chart-" + meta.row; // Usar meta.row para IDs únicos
          return '<canvas id="' + canvasId + '" width="100" height="100"></canvas>';
        },
      },
      {
        data: null,
        orderable: false,
        render: function (data) {
          return `<img src="${data.image_url}" style="height: 100px;">`
        },
      },
      {
        data: null,
        render: function (data) {
          return data.orderType === 'sell' ? `Listado a ${data.date}` : `Sold ${data.date}`
        }
      },
      { data: "finish", title: "Finish" },
      {
        data: null,
        render: function (data) {
          return `$${data.price}`
        }
      },
      {
        data: null,
        orderable: false,
        render: function (data) {
          return `
                <a href="https://illuvidex.illuvium.io/asset/0x205634b541080afff3bbfe02dcc89f8fa8a1f1d4/${data.token_id}" target="_blank">Illuvium</a>
                <a href="https://tokentrove.com/collection/IlluviumIlluvials/imx-${data.token_id}" target="_blank">TokenTrove</a>
              `;
        },
      }
    ],
    pageLength: 25,
    language: {
      url: "//cdn.datatables.net/plug-ins/1.13.4/i18n/pt-BR.json",
    },
    drawCallback: function (settings) {
      renderCharts(this.api());
    },
    rowId: 'id', // Configurar o DataTable para usar 'id' como identificador de linha
  });
}

// Função para renderizar todos os gráficos na tabela atual (permanece o mesmo)
function renderCharts(api) {
  // Destrói todas as instâncias existentes dos gráficos
  for (let key in chartInstances) {
    if (chartInstances.hasOwnProperty(key)) {
      chartInstances[key].destroy();
    }
  }
  chartInstances = {};

  // Renderiza os gráficos para as linhas atuais
  api.rows({ filter: 'applied', page: 'current' }).every(function (rowIdx, tableLoop, rowLoop) {
    const rowData = this.data();
    const canvasId = "chart-" + rowIdx; // Usar rowIdx para corresponder aos IDs
    const ctx = document.getElementById(canvasId);

    if (ctx) {
      // Renderiza o gráfico e armazena a instância
      chartInstances[canvasId] = renderChart(ctx, rowData.traits);
    }
  });
}

// Função para gerar os filtros dinamicamente (permanece o mesmo)
function generateFilters() {
  const filtersContainer = $("#filters-container");
  traitsList.forEach((trait) => {
    const filterHtml = `
      <div class="col">
          <div class="input-group input-group-sm">
              <span class="input-group-text">
                  <img src="/icon/${trait}.png" style="width: 15px; height: 15px;">
              </span>
              <select class="form-select form-select-sm" id="filter-${trait}" data-trait="${trait}">
                  <option value="0">All</option>
                  ${generateOptions()}
              </select>
          </div>
      </div>
        `;
    filtersContainer.append(filterHtml);
  });
}

// Função para formatar o nome dos traits (permanece o mesmo)
function formatTraitName(trait) {
  return trait.replace(/([A-Z])/g, " $1").trim();
}

// Função para gerar as opções dos selects (permanece o mesmo)
function generateOptions() {
  return Array.from({ length: 5 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("");
}

// Função para realizar a busca com suporte à paginação
async function performSearch() {
  const tokenName = $("#token-name").val().trim();
  const orderType = $("#order-type").val();
  const user = $("#user").val().trim();

  const priceILV = await getTokenPriceInUSD('ILV').then(price => { return price })
  const priceETH = await getTokenPriceInUSD('ETH').then(price => { return price })

  $("#filters-container select, #filter-rarity, #btnSearch, #token-name, #search-form, #order-type").prop("disabled", true);
  showLoader();

  try {
    // Verifica se pelo menos um dos campos obrigatórios está preenchido
    if (tokenName === "" && user === "") {
      hideLoader();
      alert("Por favor, insira um nome de personagem ou um usuário.");
      return;
    }

    // Monta os parâmetros iniciais da requisição
    const params = {};

    if (orderType === 'sell') {
      params.sell_token_address = TOKEN_ADDRESS
      params.sell_token_name = tokenName
      params.status = 'active'
    }

    if (orderType === 'buy') {
      params.buy_token_address = TOKEN_ADDRESS
      params.buy_token_name = tokenName
      params.status = 'filled'
    }

    if (user !== "") {
      params.user = user;
    }

    params.page_size = 200 // Limite de resultados por página

    let allResults = [];
    let cursor = null;

    // Atualiza a interface com o progresso
    $("#results-count").text(`Carregando API Immutable...`);

    // Loop para realizar requisições paginadas até obter todos os resultados
    do {
      if (cursor) {
        params.cursor = cursor;
      }

      // Faz a requisição à API do Market
      const marketResponse = await axios.get(`${API_IMMUTABLE}`, { params });
      let marketData = marketResponse.data.result;
      cursor = marketResponse.data.cursor;

      // Filtra os resultados para incluir apenas os itens cujo nome corresponde exatamente ao pesquisado
      if (tokenName !== "") {
        marketData = marketData.filter(
          (item) => {
            return item[orderType].data.properties.name.toLowerCase() === tokenName.toLowerCase()
          }
        );
      }

      allResults = allResults.concat(marketData);

      // Atualiza a interface com o progresso
      $("#results-count").text(`Carregando API Immutable... ${allResults.length} illuvials`);

    } while (cursor);

    // Atualiza a interface com o progresso
    $("#results-count").text(`Carregando API Illuvium... ${allResults.length} illuvials`);

    if (allResults.length === 0) {
      hideLoader();
      alert("Nenhum resultado encontrado.");
      return;
    }

    const tokens_id = allResults.map(order => {
      let token_id

      if (order.sell.data?.id) {
        token_id = order.sell.data.token_id
      } else {
        token_id = order.buy.data.token_id
      }

      return token_id
    })

    const detailResponses = await axios.post('https://market-ilv.vercel.app//api', {tokens_id})
      .then(response => {
        return response.data
      })
      .catch(error => {
        console.error(error);
      });

    // Combina os dados do Market com os detalhes do personagem
    const results = allResults.map((item, index) => {
      const details = (detailResponses[index]?.data) ? detailResponses[index].data : detailResponses[index];
      const image_url = item[orderType].data.properties.image_url
      const token_id = item[orderType].data.token_id

      // capturando o preço
      let price = 0
      if (item.taker_fees.token_type === 'USDC') price = item.taker_fees.quantity_with_fees.toFixed(2)
      if (item.taker_fees.token_type === 'ILV') price = (item.taker_fees.quantity_with_fees * priceILV).toFixed(2)
      if (item.taker_fees.token_type === 'ETH') price = (convertToEth(item.taker_fees.quantity_with_fees) * priceETH).toFixed(2)

      // Extrai o finish do link da imagem
      let finish = "color"; // valor padrão

      if (image_url.includes("_holo_")) {
        finish = "holo";
      } else if (image_url.includes("_holodark_")) {
        finish = "dark";
      }

      // inserindo data de venda
      const date = showDate(item.timestamp)

      return {
        ...item, ...details,
        finish: finish,
        image_url: image_url,
        date: date,
        token_id: token_id,
        orderType: orderType,
        price: price
      };
    });

    // Atualiza a contagem de resultados
    $("#results-count").text(`Total de resultados: ${results.length}`);

    // Habilita filtros e pesquisa
    $("#filters-container select, #filter-rarity, #btnSearch, #token-name, #search-form, #order-type").prop("disabled", false);

    // Após combinar os dados
    originalData = results;

    // Atualiza o grafico se for buy
    renderLineChart(originalData)

    // Limpa dados existentes
    dataTable.clear();

    // Adiciona dados ao DataTable
    dataTable.rows.add(results);
    dataTable.draw();

    // Reseta filtros
    $("#filters-container select").val("0");
  } catch (error) {
    console.error(error);
    alert("Ocorreu um erro ao realizar a busca.");
  } finally {
    hideLoader();
  }
}

// Função para aplicar filtros (permanece o mesmo)
function applyFilters() {
  if (originalData.length === 0) {
    // Sem dados para filtrar
    return;
  }
  // Inicia com os dados originais
  let filteredData = originalData.slice(); // Faz uma cópia dos dados originais

  $("#filters-container select").each(function () {
    const trait = $(this).data("trait");
    const value = $(this).val();

    if (value !== "0") {
      filteredData = filteredData.filter((item) => {
        return item.traits[trait] >= value;
      });
    }

    // Re-renderiza os gráficos sem redefinir a paginação
    dataTable.draw(false);
  });

  // Aplica filtro de finish
  const finishValue = $("#filter-finish").val().toLowerCase();
  if (finishValue !== "all") {
    filteredData = filteredData.filter((item) => {
      return item.finish.toLowerCase() === finishValue;
    });
  }

  renderLineChart(filteredData)

  // Limpa e atualiza DataTable
  dataTable.clear();
  dataTable.rows.add(filteredData);
  dataTable.draw();

  // Atualiza o gráfico (simulação)
  if ($("#graph-tab").hasClass("active")) {
    renderLineChart(); // Re-renderiza o gráfico com os filtros aplicados
  }

  // Atualiza a contagem de resultados
  $("#results-count").text("Total de resultados: " + filteredData.length);
}

// Função para renderizar o gráfico (permanece o mesmo)
function renderChart(ctx, baseStats) {
  const dataValues = traitsList.map((trait) => baseStats[trait]);
  const data = {
    labels: ["HP", "AS", "AD", "OP", "MS", "RE"],
    datasets: [
      {
        label: "Traits",
        data: dataValues,
        backgroundColor: "rgba(54, 162, 235, 0.2)",
        borderColor: "rgba(54, 162, 235, 1)",
        borderWidth: 1,
      },
    ],
  };

  const chartInstance = new Chart(ctx, {
    type: 'radar',
    data: data,
    options: {
      plugins: {
        legend: {
          display: false // Se não quiser exibir a legenda
        }
      },
      scales: {
        r: {
          min: 0,
          max: 5,
          angleLines: {
            color: '', // Cor das linhas entre os eixos
          },
          grid: {
            color: '#8A8A8A', // Cor do grid do hexágono
            lineWidth: 1
          },
          pointLabels: {
            //callback: function (label) {
            //    return ''; // Remove o texto do rótulo
            //},
            font: {
              size: 8,
              family: 'Arial', // Fonte para o texto dos rótulos
            }
          },
          ticks: {
            beginAtZero: true,  // Inicia o eixo em zero
            display: false, // Remove os ticks (números) nas bordas
            max: 5, // Define o valor máximo
            stepSize: 1, // Define o intervalo entre os ticks
          }
        }
      },
      elements: {
        line: {
          borderWidth: 1, // Largura da linha
          backgroundColor: '#fff' // Fundo com transparência
        },
        point: {
          radius: 0, // Tamanho dos pontos
          backgroundColor: 'rgba(255, 206, 86, 1)', // Cor do ponto
          borderColor: '#fff', // Cor da borda do ponto
          borderWidth: 2 // Largura da borda do ponto
        }
      },
      responsive: false,
    }
  });

  return chartInstance;
}


// Função para mostrar o loader (permanece o mesmo)
function showLoader() {
  $("#loader").removeClass("d-none");
}

// Função para esconder o loader (permanece o mesmo)
function hideLoader() {
  $("#loader").addClass("d-none");
}

// Função pra converter wei pra ETH
function convertToEth(wei) {
  const eth = wei / 1e18;
  return eth;
}

// Função pra retornar o preço do Illuvial em dolar
async function getTokenPriceInUSD(typeToken) {
  let token;
  if (typeToken === 'ILV') token = 'illuvium'
  if (typeToken === 'ETH') token = 'ethereum'

  if (token) {
    try {
      let priceInUsd;
      const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${token}&vs_currencies=usd`);

      if (typeToken === 'ILV') priceInUsd = response.data.illuvium.usd
      if (typeToken === 'ETH') priceInUsd = response.data.ethereum.usd

      return priceInUsd;
    } catch (error) {
      console.error(`Erro ao obter o preço do : ${token}`, error);
      return null;
    }
  }
}

function showDate(dataISO) {
  const data = new Date(dataISO);
  const agora = new Date();
  const diferenca = agora - data; // diferença em milissegundos

  const minutos = Math.floor(diferenca / 60000);
  const horas = Math.floor(minutos / 60);
  const dias = Math.floor(horas / 24);

  if (horas < 24) {
    if (minutos < 60) {
      return `${minutos} min`
    } else {
      return `${horas} hrs`
    }
  } else {
    return `${dias} dias`
  }
}

function converterDataISOParaDiaMesAno(dataISO) {
  // Cria um objeto Date a partir da string de data ISO
  var data = new Date(dataISO);

  // Extrai o dia, mês e ano
  var dia = String(data.getUTCDate()).padStart(2, '0'); // Adiciona zero à esquerda, se necessário
  var mes = String(data.getUTCMonth() + 1).padStart(2, '0'); // Os meses são baseados em zero, então somamos 1
  var ano = data.getUTCFullYear();

  // Retorna a data no formato dia/mês/ano
  return `${dia}/${mes}/${ano}`;
}
