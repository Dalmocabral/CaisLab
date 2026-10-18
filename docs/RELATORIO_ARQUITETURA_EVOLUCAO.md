# Relatório Arquitetural e Plano de Evolução do CaisLab
**Documento Técnico e Estratégico de Engenharia de Software Portuária**  
**Autor:** Especialista em Simulação, Sistemas Portuários, 2D/3D e Performance  
**Destinatário:** Equipe de Planejamento e Engenharia — CaisLab  
**Data:** Outubro de 2026  
**Versão:** 2.0 (Planejamento Tático e Operacional)

---

## Sumário Executivo

O **CaisLab** consolidou-se como uma ferramenta de alta fidelidade visual para o cais do Tecon Rio (900 m de cais, 33 cabeços reais, portêineres P4 a P9 e plantas de convés de navios porta-contêineres e tanques). 

O desafio atual é **evoluir de uma representação estática ("foto de um instante") para uma plataforma de apoio à decisão operacional dinâmica**, permitindo ao usuário planejar, visualizar, comparar e reproduzir cenários de atracação e operação de guindastes no tempo, **sem tornar a ferramenta pesada, lenta ou complexa demais para o dia a dia**.

Este relatório apresenta o diagnóstico técnico, a análise crítica de custo-benefício de cada proposta, a arquitetura de módulos recomendada e um cronograma incremental em três fases.

---

## 1. Diagnóstico do Estado Atual do CaisLab

### 1.1 Stack Tecnológico e Pontos Fortes
- **Motor 2D Vetorial (`client/src/components/berth-blueprint.tsx`):** Desenvolvido em puro SVG reativo. Altíssima nitidez, zoom fluido (50% a 400%), renderização instantânea e drag-and-drop nativo de navios, portêineres e cabos de amarração.
- **Motor 3D sob Demanda (`client/src/components/Berth3DViewer.tsx`):** Three.js modular carregado via lazy-import. Utiliza `InstancedMesh` para representar milhares de contêineres e texturas WebP de alta fidelidade com payload reduzido (~880 KB para todas as skins).
- **Modelo de Domínio Realista (`client/src/lib/berth-model.ts`):** Contém regras físicas estritas já codificadas:
  - Trechos de cais: Expansão (85 m), Prolongamento (430 m) e Tecon 1 (385 m).
  - Posições milimétricas dos cabeços 309 a 277 (com fotos reais de cabeços simples, duplos e baixos).
  - Trava operacional de portêineres (P5 não passa para a esquerda de 297–296; P6 não passa para a direita de 291–290; P4 limitado a 279).
  - Bloqueio físico de trilho entre portêineres adjacentes (distância mínima de 27 m).
  - Validações de altura e alcance de lança (`boomHeight`, `boomOutreach`) contra boca e tiers de contêineres.

### 1.2 Gargalos e Oportunidades Identificados
| Componente | Estado Atual | Limitação Operacional |
| :--- | :--- | :--- |
| **Dimensão Temporal** | Estático ($t = t_0$) | Não modela a evolução temporal da escala (ETA $\to$ Atracação $\to$ Operação $\to$ ETD). |
| **Planejamento de Guindastes** | Posição estática dos portêineres | Não reflete a divisão de trabalho por bay (Crane Split) comumente usada no TOS. |
| **Posicionamento Manual** | Drag-and-drop livre | Exige que o usuário ajuste manualmente no olho o afastamento de 15 m e o alinhamento com os cabeços. |
| **Comparação de Alternativas** | Cenário único ativo | O planejador não consegue alternar instantaneamente entre "Opção A" e "Opção B" para comparar métricas. |
| **Integração 2D / 3D** | Visualizador 3D isolado em modal | O 3D funciona como exibição passiva, sem conexão com a linha do tempo ou status operacional. |

---

## 2. Análise Crítica de Funcionalidades (Custo $\times$ Benefício)

Para cada proposta levantada, avaliou-se o problema real, benefícios, limites, complexidade, riscos, alternativas e recomendação formal:

```
+---------------------------------------------------------------------------------------------------+
|                               MATRIZ VALOR x COMPLEXIDADE TÉCNICA                                  |
+---------------------------------------------------------------------------------------------------+
| ALTO VALOR    |  [Auto-Snap & Validador de Berço]      [Quay Timeline / Crane Split 2D]           |
| OPERACIONAL   |  [Comparador de Cenários (A vs B)]     [Timeline Replay Sincronizado no 3D]       |
|               |                                                                                   |
| BAIXO VALOR   |  [Reescrita de Tela 2D Dedicada]       [Física Hidrodinâmica / Tensões Reais]     |
| OPERACIONAL   |                                        [IA Generativa para Atracação]             |
+---------------+-----------------------------------------------------------------------------------+
|               | BAIXA / MÉDIA COMPLEXIDADE             ALTA COMPLEXIDADE / RISCO DE INFLAÇÃO      |
+---------------+-----------------------------------------------------------------------------------+
```

### Proposta A: Visualização 2D Superior Dedicada para Limites, Distâncias e Conflitos
- **Problema:** O blueprint 2D atual é rico em detalhes internos (escotilhas, passadiço, fotos de cabeços), o que por vezes dispersa o foco da visão macro (se o navio cabe no berço e qual a distância exata até o vizinho).
- **Benefício:** Apresentação clara e desimpedida das folgas de segurança, cotas dinâmicas em metros e alertas de ultrapassagem de trecho de cais.
- **Limitações:** Criar uma "nova tela 2D separada" duplicaria lógica e aumentaria manutenção.
- **Complexidade:** **Baixa** (se implementada como um modo de exibição alternável no blueprint atual); **Alta** (se for um componente do zero).
- **Riscos:** Sobrecarga de telas.
- **Alternativa Simples:** Adicionar um botão de alternância no próprio blueprint: **[Modo Realista / Detalhado]** $\leftrightarrow$ **[Modo Tático / Folgas]**, que oculta detalhes de convés e renderiza halos de segurança (15 m) e réguas dinâmicas de distância entre cascos.
- **Recomendação:** **IMPLEMENTAR NA FASE 1 (dentro do componente existente).**

---

### Proposta B: Linha do Tempo Sincronizada com o 3D (Reprodução de 6h em 1–2 min)
- **Problema:** Não é possível visualizar a transição operacional (navio desatracando, novo navio entrando, guindastes se deslocando entre escotilhas ao longo dos turnos).
- **Distinção Técnica Crucial:**
  - *Rejeitar:* Simulação física contínua (motores físicos de corpos rígidos, hidrodinâmica de onda, elasticidade de cabos). Custo gigantesco, imprevisível, pesado para WebGL e inútil para o planejamento tático de berço.
  - *Adotar:* **Animação determinística baseada em eventos programados (Keyframe / Event Replay)**. O estado em qualquer instante $t$ é calculado analiticamente por interpolação linear ($x(t) = x_0 + v \cdot \Delta t$).
- **Benefício:** Apresentação dinâmica de altíssimo impacto para reuniões de pré-atracação, praticagem e diretoria.
- **Complexidade:** **Média**. O Three.js já possui os meshes criados; atualizar `group.position.x` de 6 guindastes em um loop `requestAnimationFrame` consome menos de **0,2 ms de CPU por frame**.
- **Riscos:** Se o cadastro de eventos for manual e exaustivo, o operador não usará.
- **Alternativa Simples:** Barra de reprodução compacta (`Play`, `Pause`, `Velocidades 1x, 5x, 30x, 60x`, Slider de tempo `00:00` a `24:00`) alimentada por cronograma simplificado de portêineres e horários de atracação.
- **Recomendação:** **IMPLEMENTAR NA FASE 2.**

---

### Proposta C: Representação de Eventos e Programação no Estilo TOS (Quay Commander / Crane Split)
*(Inspirada na ferramenta operacional exibida na imagem enviada pelo usuário)*
- **Problema:** No terminal de contêineres, a viabilidade de atracar um navio em determinada posição depende diretamente do alcance e do tempo de permanência dos guindastes em cada escotilha (Crane Work List).
- **Benefício:** Gráfico de Espaço-Tempo (Gantt de Cais):
  - Eixo X: Bays do navio (76, 72, ..., 02, 01);
  - Eixo Y: Linha do tempo (horas da operação);
  - Blocos coloridos: Alocação de cada portêiner (P07, P06, P09), respeitando o sequenciamento físico nos trilhos (P7 sempre à esquerda de P6; P6 à esquerda de P9, etc.).
- **Limitações:** Não deve tentar substituir o TOS nem fazer controle de contêineres individuais no pátio (Yard Planning).
- **Complexidade:** **Média**. Desenvolvido em SVG puro com cálculo determinístico de conflitos de trilho.
- **Riscos:** Complexidade excessiva no cadastro de dados. Deve possuir preenchimento automático (ex.: taxa padrão de 25 ou 30 movimentos/hora por portêiner).
- **Alternativa Simples:** Painel dobrável inferior no simulador que permite arrastar blocos de trabalho por bay e calcular automaticamente a hora de término estimada da operação.
- **Recomendação:** **IMPLEMENTAR NA FASE 2.**

---

### Proposta D: Automação de Posicionamento, Detecção de Conflitos e Comparação de Cenários
- **Problema:** O operador perde tempo calculando mentalmente folgas e tentando achar o melhor encaixe entre navios.
- **Subfuncionalidades:**
  1. *Snap Magnético Inteligente:* Ao soltar o navio, o CaisLab sugere o ajuste automático para a folga regulamentar de 15 m ou centralização no melhor grupo de cabeços. *(Recomendação: FASE 1)*.
  2. *Comparação de Cenários (A/B Testing):* Criar e comparar "Cenário 1 (Oficial)" vs "Cenário 2 (Alternativo com maré alta)", com resumo comparativo de folgas, ocupação e guindastes. *(Recomendação: FASE 1)*.
  3. *Otimização com IA Generativa / Algoritmos Genéticos:* **DESCARTAR.** Totalmente desnecessária e contraproducente. Regras determinísticas de intervalo unidimensional (1D Bin Packing / Interval Partitioning) resolvem 100% dos casos de atracação em menos de **2 milissegundos**, com rastreabilidade completa e sem risco de alucinação.

---

## 3. Matriz de Priorização

| Prioridade | Funcionalidade | Esforço | Impacto | Decisão |
| :--- | :--- | :---: | :---: | :--- |
| **ALTA** | **Auto-Snap & Assistente de Encaixe de Berço** | 2 dias | Alto | **Implementar Fase 1** |
| **ALTA** | **Modo 2D Tático de Conflitos e Folgas** | 2 dias | Alto | **Implementar Fase 1** |
| **ALTA** | **Gerenciador de Múltiplos Cenários (Planos A / B / C)** | 1.5 dia | Alto | **Implementar Fase 1** |
| **MÉDIA** | **Módulo Quay Commander (Gantt Bay x Tempo)** | 4 dias | Altíssimo | **Implementar Fase 2** |
| **MÉDIA** | **Linha do Tempo e Replay 2D/3D Sincronizado** | 3 dias | Alto | **Implementar Fase 2** |
| **BAIXA** | **Importador de Escala de Atracação via Planilha** | 2 dias | Médio | **Implementar Fase 3** |
| **DESCARTAR**| **Motor de Física 3D (RigidBody / Hidrodinâmica)** | Alto | Nulo | **Descartar** |
| **DESCARTAR**| **Inteligência Artificial / LLM no Planejamento** | Alto | Quase Nulo | **Descartar** |
| **DESCARTAR**| **Reescrita de Tela 2D Paralela** | Alto | Baixo | **Descartar** |

---

## 4. Arquitetura Recomendada, Módulos e Fluxo de Dados

A arquitetura permanece estritamente **Client-Side**, sem dependências de backend ou bancos de dados adicionais, garantindo que o simulador continue rodando diretamente no navegador (incluindo GitHub Pages).

### 4.1 Modelo de Dados Aditivo (Compatível com Versões Anteriores)
Adiciona-se a `client/src/lib/berth-model.ts` sem quebrar o schema existente:

```typescript
export interface VesselSchedule {
  eta?: string; // Chegada estimada
  etb?: string; // Atracação estimada
  etc?: string; // Término de operações estimado
  etd?: string; // Desatracação estimada
}

export interface CraneTask {
  id: string;
  portainerId: string; // P4, P5, P6, P7, P8, P9
  vesselId: string;
  bayNumber: number;   // Bay de trabalho (ex: 58, 64, 72)
  startMinute: number; // Minuto da simulação (0 a 720)
  endMinute: number;
  movesPlanned: number;
}

export interface OperationalTimeline {
  durationMinutes: number; // Ex: 360 min (6 horas) ou 720 min (12 horas)
  tasks: CraneTask[];
}
```

---

## 5. Plano de Implementação Incremental

```
CRONOGRAMA DE ENTREGA INCREMENTAL:
[ FASE 1: Automação Tática & Snap ] ===> [ FASE 2: Quay Timeline & Replay ] ===> [ FASE 3: Comparador A/B & Relatórios ]
  (100% compatível, sem risco)             (Estilo Quay Commander TOS)               (Pronto para decisão de diretoria)
```

### FASE 1: Automação Tática, Snap e Validação Inteligente
- **Objetivo:** Eliminar o atrito de posicionamento manual e destacar visualmente os limites regulamentares no 2D.
- **Entregáveis:**
  1. Alternador **"Modo Realista"** $\leftrightarrow$ **"Modo Tático"** em `client/src/components/berth-blueprint.tsx`.
  2. Linhas de cota dinâmicas em metros entre bicos de navios vizinhos e cabeceiras de cais.
  3. Botão de ação rápida: `[Ajustar folga regulamentar (15 m)]` e `[Alinhar a cabeços ótimos]`.
  4. Gerenciador multi-cenários no `client/src/pages/Simulator.tsx` (Planos A / B / C com chaveamento instantâneo).
- **Critérios de Aceitação:**
  - O operador clica no botão de ajuste e o navio se reposiciona respeitando exatamente 15 m do vizinho;
  - Todas as distâncias e folgas críticas são legíveis em cotas numéricas na tela.

---

### FASE 2: Quay Commander (Matriz Bay $\times$ Tempo) e Linha do Tempo Replay
- **Objetivo:** Reproduzir a ferramenta operacional da imagem enviada (`Crane Work List` + `Quay Commander`) integrada ao cais 2D e 3D.
- **Entregáveis:**
  1. Componente `QuayCommander.tsx`: grade SVG Bay $\times$ Hora com blocos de guindastes arrastáveis.
  2. Validação automática de trilho: impede que a programação cruze guindastes (P7 sempre à esquerda de P6, etc.) e sinaliza colisões temporais.
  3. Barra de controle de tempo `BerthTimelineBar.tsx` (`Play`, `Pause`, `1x a 60x`, Slider de tempo).
  4. Sincronização 3D: ao rodar a timeline, os portêineres no `client/src/components/Berth3DViewer.tsx` se deslocam suavemente sobre os navios sem recriar meshes.
- **Critérios de Aceitação:**
  - Uma operação de 6 horas é reproduzida em 60 segundos;
  - O operador identifica visualmente qualquer momento em que uma bay ficou sem guindaste ou em que houve ociosidade de berço.

---

### FASE 3: Comparador Avançado e Relatórios Executivos
- **Objetivo:** Suportar reuniões gerenciais com métricas consolidadas de produtividade de cais.
- **Entregáveis:**
  1. Modal comparativo lado a lado: Metros de cais ociosos, número de guindastes alocados e tempo de berço ocupado entre Plano A e Plano B.
  2. Exportação de prancha operacional consolidada (Blueprint 2D + Diagrama Quay Commander + Lista de Amarração) em alta resolução para impressão ou PDF.

---

## 6. As Três Melhorias Prioritárias e o que FICA FORA DO ESCOPO

### As 3 Prioridades Absolutas:
1. **Assistente de Snap Inteligente & Cotas Dinâmicas no 2D:** Converte a prancheta de desenho em um calculador operacional instantâneo.
2. **Diagrama Operacional "Quay Commander" (Bays $\times$ Tempo):** Implementa o fluxo de trabalho exato dos terminais de contêineres mostrado na sua foto de referência.
3. **Barra de Linha do Tempo com Replay Sincronizado no 3D:** Permite enxergar a operação no tempo em 1 minuto, gerando enorme clareza de comunicação.

### O que FICA ESTRITAMENTE FORA DO ESCOPO:
- **Motores físicos pesados:** Hidrodinâmica e dinâmica de corpos rígidos deixariam a aplicação lenta e não ajudam a planejar o berço.
- **Backend ou bancos de dados obrigatórios:** O CaisLab continuará 100% autônomo, rápido e capaz de rodar estaticamente no navegador.
- **Substituição de funções do TOS:** Não fazer faturamento, controle de gate ou inventário de pátio. O foco do CaisLab é a **interface cais-navio-guindaste**.
- **IA Generativa sem determinismo:** Decisões portuárias exigem regras matemáticas transparentes e auditáveis, não algoritmos black-box.

---

## 7. Resposta à Pergunta Central

> *"Como automatizar e facilitar o planejamento de atracação sem tornar o CaisLab pesado, complexo ou cheio de funcionalidades que ninguém usará?"*

A estratégia consiste em adotar o **Princípio da Automação Assistida (Human-in-the-Loop) com Complexidade Progressiva**:

1. **A tela principal continua idêntica e rápida:** Quem só quer posicionar um navio e ver a amarração (como faz hoje) faz isso em 10 segundos, sem barreiras.
2. **A automação entra como sugestão sutil de 1 clique:** Botões como `[Folga regulamentar 15 m]` e `[Centralizar guindastes]` poupam minutos de ajustes manuais no mouse.
3. **A complexidade temporal fica encapsulada:** O diagrama *Quay Commander* e a barra de timeline ficam em uma gaveta retrátil inferior (docked drawer). Quem precisa apenas da visão espacial não é incomodado; quem precisa planejar o turno operacional tem em mãos a mesma linguagem consagrada dos sistemas de cais profissionais.
