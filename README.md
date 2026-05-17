# ∿ FuncGraph — Explorador Interativo de Funções Trigonométricas

O **FuncGraph** é uma aplicação desktop multiplataforma projetada para fins educacionais, permitindo que estudantes e entusiastas explorem o comportamento visual, analítico e dinâmico de funções trigonométricas e suas inversas em tempo real. Através de manipulações paramétricas diretas, a aplicação ilustra como coeficientes matemáticos alteram propriedades essenciais das curvas, como amplitude, período, fase e deslocamento vertical.

---

## 🚀 Tecnologias Utilizadas

A arquitetura do projeto foi estruturada unindo a alta performance de uma base nativa com a flexibilidade de uma interface reativa moderna:

### 🎮 Frontend (Interface Gráfica)
* **React 19:** Utilizado como biblioteca core para a construção da interface modular baseada em componentes reativos, gerenciamento de estados locais (`useState`, `useRef`) e otimização de ciclos de renderização.
* **Vite 8:** Ferramenta de build e bundling de altíssima velocidade, responsável pelo desenvolvimento ágil com *Hot Module Replacement (HMR)* instantâneo.
* **HTML5 Canvas API:** Responsável pela renderização matemática direta dos gráficos bidimensionais, garantindo alta performance mesmo sob constantes atualizações de parâmetros (60 FPS estáveis).
* **CSS3 Custom Properties:** Implementação de animações personalizadas de fluxo, efeitos de brilho em gradiente neo-brutalista (*glow-effects*) e responsividade de componentes fluida.

### 🦀 Backend & Distribuição Desktop
* **Tauri v2:** Framework focado em segurança e eficiência utilizado para empacotar o ecossistema web em um aplicativo nativo para desktop. Ao contrário do Electron, o Tauri utiliza a engine de WebView nativa do sistema operacional, resultando em binários incrivelmente leves (poucos megabytes) e consumo de memória RAM drasticamente menor.
* **Rust (Edição 2021):** Linguagem utilizada no núcleo do backend desktop, garantindo segurança de memória em tempo de compilação, paralelismo seguro e estabilidade no ciclo de vida da aplicação nativa.

---

## 🛠️ Funcionalidades Implementadas

### 1. Catálogo e Seleção de Funções Trigonométricas
A tela inicial apresenta um painel interativo contendo seis funções matemáticas fundamentais:
* **Seno:** $f(x) = \sin(x)$ (Função periódica oscilante padrão entre $-1$ e $1$)
* **Cosseno:** $f(x) = \cos(x)$ (Função periódica defasada em $\pi/2$)
* **Tangente:** $f(x) = \tan(x)$ (Diverge em múltiplos de $\pi/2$ gerando assíntotas verticais)
* **Arco Seno:** $f(x) = \arcsin(x)$ (Inversa do seno, limitada ao domínio $[-1, 1]$)
* **Arco Cosseno:** $f(x) = \arccos(x)$ (Inversa decrescente do cosseno, domínio $[-1, 1]$)
* **Arco Tangente:** $f(x) = \arctan(x)$ (Inversa da tangente, limitada assintoticamente entre $-\pi/2$ e $\pi/2$)

Cada opção possui um *Card com Preview Dinâmico em SVG*, simulando o formato original da onda correspondente.

### 2. Manipulador Paramétrico Avançado (Sidebar)
Ao selecionar uma função, o usuário ganha controle sobre a forma geral da equação trigonométrica:
$$f(x) = A \cdot \text{função}(B \cdot x - C) + D$$

* **Amplitude (A):** Controla o estiramento ou compressão vertical do gráfico.
* **Frequência / Velocidade Angular (B):** Altera diretamente o período da onda. O painel calcula e exibe automaticamente o período em tempo real ($\frac{2\pi}{B}$ para seno/cosseno e $\frac{\pi}{B}$ para tangente).
* **Fase (C):** Ajusta o deslocamento horizontal da onda em radianos.
* **Deslocamento Vertical (D):** Translada a curva inteira para cima ou para baixo ao longo do eixo $y$.

**Diferencial Técnico de Input:** Além dos Sliders convencionais, os limites mínimo, máximo e o passo (*step*) de cada parâmetro podem ser editados manualmente e individualmente direto na interface, oferecendo controle absoluto da escala observada.

### 3. Exibição Dinâmica de Fórmulas
Uma string formatada analisa matematicamente os coeficientes atuais para renderizar a equação exatamente como ela seria escrita em notação matemática formal (omitindo multiplicações por $1$ ou somas nulas por $0$ de maneira inteligente).

### 4. Canvas com Manipulação Bidirecional (Zoom & Pan)
O motor gráfico desenvolvido sobre o Canvas HTML5 suporta:
* **Navegação Livre (Pan):** Clique e arraste na área do gráfico para mover os eixos Cartesianos $X$ e $Y$ em qualquer direção.
* **Zoom Fluido:** Scroll do mouse (ou botões flutuantes $+$ e $-$) aplicam zoom progressivo focado na viewport.
* **Grade Inteligente baseada em Radianos:** As linhas verticais de marcação se adaptam dinamicamente a frações e múltiplos de $\pi$ (ex: $-\pi$, $-\pi/2$, $0$, $\pi/2$, $\pi$, $2\pi$), facilitando a análise analítica trigonométrica.
* **Prevenção de Assíntotas Irreais:** O algoritmo detecta descontinuidades matemáticas drásticas em funções como a Tangente, quebrando a linha e evitando traços verticais espúrios que conectariam incorretamente o $+\infty$ ao $-\infty$.

### 5. Integração com Servidor Local
A aplicação possui um sistema de sincronização integrado capaz de converter os parâmetros matemáticos configurados e despachar uma requisição HTTP via `POST` (`/api/graph`) para fins de persistência de dados ou processamento de relatórios em um servidor externo parceiro.

---

## 📁 Estrutura de Pastas Relevantes

```text
FuncGraph/
├── src/
│   └── frontend/              # Interface do Usuário (React + CSS)
│       ├── App.jsx            # Router/Orquestrador do estado principal
│       ├── FunctionSelector   # Componente da vitrine/catálogo de funções
│       └── GraphView          # Componente do Canvas e painel paramétrico
├── src-tauri/                 # Configurações do Engine Desktop Nativo
│   ├── Cargo.toml             # Manifesto de Dependências Rust
│   ├── tauri.conf.json        # Permissões, Capacidades e Janelas Tauri
│   └── src/
│       ├── main.rs            # Ponto de entrada do binário compilado
│       └── lib.rs             # Configuração e inicialização de plugins (Log)
├── api/                       # Servidor local mock (Node.js) para requisições
├── package.json               # Gerenciador de dependências Node (Vite/React/Plugins)
└── eslint.config.js           # Padronização de qualidade de código