/* ---------------------------------------------------------------------
   DIÁLOGOS E HISTÓRIA (dialogues-data.js) — só dados, lidos por
   DialogueModule (js/dialogue.js) e StoryModule (js/story.js).

   RASCUNHO DA HISTÓRIA — os textos de STORY_CHAPTERS e das cenas
   floorEnd_* / cityAfter_* são uma proposta pra revisão. Pode reescrever à
   vontade: o formato é o mesmo em todo lugar.

   Cada roteiro em DIALOGUES é { lines: [...] } e cada linha é UMA destas:
     { speaker, text }                  fala (speaker = chave de DIALOGUE_SPEAKERS)
     { speaker, text, memory, choices } fala com respostas prontas: ao escolher,
                                        state.dialogueMemory[memory] = choice.id
                                        e o NPC responde com choice.reply
     { chapter, title, text? }          cartão de capítulo (tela de título)
   Opcionais em qualquer linha:
     when: 'chave=valor'  só aparece se a resposta lembrada for essa
           'chave'        só se existir qualquer resposta pra essa chave
           '!chave'       só se ainda não existir
   Opcionais numa resposta (choice):
     action: nome de uma ação de DialogueModule.actions, roda quando a
             conversa termina (ex.: abrir a Academia)
   Marcação no texto: *negrito*, {nome} (nome do herói), {pontosArcanos}.
   As respostas NUNCA mudam a história — só o que os NPCs comentam depois.
--------------------------------------------------------------------- */

// `voice`: timbre do "bip" de fala (ver DialogueModule.voiceBlip) — pitch em
// Hz, onda do oscilador e quanto o tom varia de letra pra letra.
// `sprite: true`: o retrato é uma folha de monstro (3 frames lado a lado) —
// mostra só o 1º frame. `frame`: o retrato é um quadro de uma folha de
// morador da cidade (art/npc: cols × rows quadros de w × h px) — mostra o 1º.
const DIALOGUE_SPEAKERS = {
  anselmo:  { name: 'Irmão Anselmo', role: 'Clérigo da cidade', portrait: 'assets/portraits/anselmo.png', voice: { pitch: 185, wave: 'triangle', vary: 0.10 } },
  barnabe:  { name: 'Barnabé', role: 'Dono da Loja', portrait: 'assets/portraits/barnabe.png', voice: { pitch: 250, wave: 'square', vary: 0.18 } },
  creiton:  { name: 'Creiton', role: 'Ferreiro', portrait: 'assets/portraits/creiton.png', voice: { pitch: 125, wave: 'square', vary: 0.10 } },
  aldo:     { name: 'Professor Aldo', role: 'Professor da Academia de Combate', portrait: 'assets/portraits/aldo.png', voice: { pitch: 310, wave: 'sine', vary: 0.14 } },
  goblinRei:{ name: 'Goblin Maior', role: 'Chefe do Reino Goblin', portrait: 'assets/sprites/goblin_greater.png', sprite: true, voice: { pitch: 420, wave: 'sawtooth', vary: 0.30 } },
  dragao:   { name: 'Dragão', role: 'Senhor do andar em chamas', portrait: 'assets/sprites/dragon.png', sprite: true, voice: { pitch: 70, wave: 'sawtooth', vary: 0.08 } },
  morgana:  { name: 'Madame Morgana', role: 'Bruxa (só aparece à noite)', portrait: 'assets/sprites/npc-witch.png', frame: { w: 32, h: 48, cols: 3, rows: 3 }, voice: { pitch: 360, wave: 'triangle', vary: 0.22 } },
  narrador: { name: '', narrator: true, voice: { pitch: 95, wave: 'sine', vary: 0.04 } },
};

// Um capítulo por andar, na ordem de DUNGEON_ORDER. O capítulo termina ao
// vencer o último ciclo do andar pela 1ª vez: toca a cena `floorEnd_<andar>`
// na própria dungeon e, de volta à cidade, `cityAfter_<andar>` + o cartão
// do próximo capítulo (ver StoryModule). A missão do capítulo aparece na
// aba História da janela de Missões.
const STORY_CHAPTERS = [
  { dungeon: 'slimes',  num: 'Capítulo I',   title: 'O Pântano dos Slimes', text: 'Algo borbulha além do portão da cidade.' },
  { dungeon: 'goblins', num: 'Capítulo II',  title: 'O Reino Goblin',       text: 'Risadas agudas ecoam no escuro. Alguém anda guardando o que não é seu.' },
  { dungeon: 'wilds',   num: 'Capítulo III', title: 'As Terras Selvagens',  text: 'Uma floresta inteira, dentro de uma dungeon. E ela está com medo.' },
  { dungeon: 'dragons', num: 'Capítulo IV',  title: 'O Andar do Dragão',    text: 'O ar ferve. Asas enormes batem no escuro.' },
  { dungeon: 'demons',  num: 'Capítulo V',   title: 'Além do Portão',       text: 'A porta de pedra negra está rachada. Do outro lado, algo empurra.' },
];

const DIALOGUES = {
  // ---------------- apresentações (antes eram modais fixos no index.html) ----------------
  shopUnlock: { lines: [
    { speaker: 'anselmo', text: 'A notícia já chegou aos meus ouvidos: alguém teve coragem de enfrentar os monstros lá fora!' },
    { speaker: 'anselmo', text: 'Vá até a *Loja* da cidade e venda o que você encontrou por lá. Ouvi dizer que o dono ainda consegue negociar alguns produtos.' },
  ] },
  // na volta da 3ª entrada na Dungeon (ver OnboardingModule.announceAcademiaIfNeeded)
  academiaUnlock: { lines: [
    { speaker: 'anselmo', text: '{nome}! Voltou inteiro, graças aos céus. Mas parece que está sendo mais difícil do que você esperava, não é?', memory: 'academia', choices: [
      { id: 'admite', text: 'Bem mais difícil.', reply: 'Não há vergonha nisso. Coragem sem preparo só enche cemitério.' },
      { id: 'orgulho', text: 'Nada que eu não aguente.', reply: 'Hm. Seus arranhões dizem outra coisa.' },
    ] },
    { speaker: 'anselmo', text: 'Venha comigo. Vou te levar pra conhecer alguém que pode ajudar: o *Professor Aldo*.' },
    { speaker: 'narrador', text: 'Vocês atravessam a praça até um casarão de pedra. Lá dentro, pilhas de livros, pergaminhos por todo lado e um cheiro forte de vela queimada.' },
    { speaker: 'aldo', text: 'Anselmo! E este deve ser o forasteiro de quem a cidade toda fala. {nome}, não é?' },
    { speaker: 'aldo', text: 'Sou Aldo. Esta é a *Academia de Combate*... ou o que sobrou dela depois que os instrutores fugiram.' },
    { speaker: 'aldo', when: 'academia=orgulho', text: 'O Anselmo disse que você aguenta tudo. Ótimo! Então vai aguentar estudar.' },
    { speaker: 'aldo', text: 'Força bruta só leva você até o primeiro chefe. Aqui a gente estuda técnica: golpes mais fortes, críticos, fôlego pra ficar mais tempo lá embaixo.' },
    { speaker: 'aldo', text: 'Cada técnica custa algumas moedas. Livro não se paga sozinho. Vamos ver por onde você começa?' },
  ] },
  barnabeIntro: { lines: [
    { speaker: 'barnabe', text: 'Ah, um forasteiro por essas bandas! Sou Barnabé, dono desta loja.' },
    { speaker: 'barnabe', text: 'Os negócios andam fracos desde que a dungeon apareceu... mas de vez em quando ainda consigo negociar alguns produtos.' },
    { speaker: 'barnabe', text: 'Aliás... meu irmão Creiton é ferreiro, mas fugiu quando os monstros surgiram. Ele quer voltar, mas precisa de material.' },
    { speaker: 'barnabe', text: 'Se você me trouxer *10 Geleias de Slime*, eu repasso pra ele e o convenço a reabrir a forja.', memory: 'barnabe', choices: [
      { id: 'ajudar', text: 'Pode contar comigo.', reply: 'Que bom! O Creiton vai ficar felicíssimo. Ele é rabugento, mas tem um coração de ouro.' },
      { id: 'pagar', text: 'E o que eu ganho com isso?', reply: 'Hah! Um ferreiro de volta na cidade, ora. E meus melhores preços, prometo.' },
    ] },
    { speaker: 'barnabe', text: 'O pedido fica anotado na sua janela de *Missões*. Boa caçada!' },
  ] },
  creitonIntro: { lines: [
    { speaker: 'creiton', text: 'Então é você quem convenceu meu irmão a me mandar aquele material...' },
    { speaker: 'creiton', when: 'barnabe=pagar', text: 'O Barnabé disse que você negocia duro. Gosto disso. Gente mole não dura lá embaixo.' },
    { speaker: 'creiton', text: 'Sou Creiton, o ferreiro desta cidade. Forjo armas novas do zero e conserto as armas brutas que você trouxer da dungeon.' },
    { speaker: 'creiton', text: 'Já que está aqui, tenho um pedido. Pra equipar uma tropa de defesa de verdade, preciso de três coisas:' },
    { speaker: 'creiton', text: '*8 Compostos de Slime* pra temperar o metal, prova de que já derrotou o chefe de algum ciclo, e que você tenha pelo menos *2 armas iniciais* diferentes.' },
    { speaker: 'creiton', text: 'A 2ª você compra aqui mesmo. Traga tudo e a Guilda finalmente arma uma tropa.', memory: 'creiton', choices: [
      { id: 'justo', text: 'Parece justo.', reply: 'É justo. E é o mínimo pra não mandar ninguém morrer com espada de pau.' },
      { id: 'caro', text: 'Você cobra caro pelas coisas.', reply: 'Cobro o que vale. Pergunte ao meu irmão quanto custa um funeral.' },
    ] },
  ] },
  anselmoCaveIntro: { lines: [
    { speaker: 'anselmo', text: 'Já que está aqui, tenho um pedido.' },
    { speaker: 'anselmo', text: 'A *Caverna* ao norte da cidade está fechada há anos, e os poucos mineradores que restaram têm medo demais de voltar sozinhos.' },
    { speaker: 'anselmo', text: 'Traga-me *20 Geleias de Slime* e *15 Compostos de Slime*, e prove que já derrotou o chefe de algum ciclo lá na dungeon.' },
    { speaker: 'anselmo', text: 'Com isso eu os convenço a voltar ao trabalho e reabrir a Caverna pra você.' },
  ] },
  // ao abrir a Academia depois do 1º Ponto Arcano (1º chefe de ciclo vencido)
  arcaneIntro: { lines: [
    { speaker: 'aldo', text: 'Espere, {nome}. Chegue mais perto... Você derrotou um chefe lá embaixo, não foi?' },
    { speaker: 'aldo', text: 'Estudo há anos a magia que escorre daquela dungeon, e agora ela está grudada em você. Dá pra sentir daqui.' },
    { speaker: 'aldo', text: 'Cada vez que você derrota o chefe de um ciclo pela primeira vez, absorve um *Ponto Arcano*.' },
    { speaker: 'aldo', text: 'Abri uma ala nova da Academia: as *Habilidades Arcanas*. Aqui eu te ensino a dominar o *Fogo*, o *Raio* e o *Gelo*. Elas lutam sozinhas ao seu lado.' },
    { speaker: 'aldo', text: 'Você tem *{pontosArcanos}* Ponto(s) Arcano(s). Quer dar uma olhada?', choices: [
      { id: 'ver', text: 'Mostre-me.', action: 'showArcaneTab' },
      { id: 'depois', text: 'Depois.', reply: 'Sem pressa. A aba nova fica aberta pra quando você quiser. A magia não vai a lugar nenhum... espero.' },
    ] },
  ] },

  // ---------------- capítulo I: Pântano ----------------
  floorEnd_slimes: { lines: [
    { speaker: 'narrador', text: 'O Slime Rei Vermelho estremece. A coroa de ferro afunda na geleia... e o pântano inteiro fica em silêncio.' },
    { speaker: 'narrador', text: 'Onde o rei caiu, uma marca antiga brilha no chão de pedra: um círculo partido ao meio, como uma porta entreaberta.' },
    { speaker: 'narrador', text: 'Por uma fresta na parede, você ouve risadas agudas e o tilintar de moedas. O andar de baixo acordou.' },
  ] },
  cityAfter_slimes: { lines: [
    { speaker: 'anselmo', text: '{nome}! Os mineradores disseram que o pântano ficou quieto de repente. Foi você?', memory: 'primeiraVitoria', choices: [
      { id: 'humilde', text: 'Tive sorte.', reply: 'Sorte não derruba um rei. Mas a humildade te cai bem.' },
      { id: 'orgulho', text: 'Foi fácil.', reply: 'Fácil... Guarde essa confiança. Vai precisar dela lá embaixo.' },
      { id: 'geleia', text: 'Estou coberto de geleia.', reply: 'Hah! A fonte da praça está aí pra isso.' },
    ] },
    { speaker: 'anselmo', text: 'Diga-me uma coisa: onde o rei caiu, você viu alguma marca no chão? Um círculo partido?' },
    { speaker: 'anselmo', text: '... Eu temia isso. É o símbolo da minha ordem. Um *selo*, feito há muitas gerações.' },
    { speaker: 'anselmo', text: 'Não sei ainda o que ele prende. Mas, se o selo está se partindo, a dungeon não surgiu por acaso.' },
    { speaker: 'anselmo', text: 'Dizem que os goblins do andar de baixo guardam tudo o que brilha. Se houver pedaços desse selo por lá... eles saberão onde.' },
  ] },

  // ---------------- capítulo II: Goblins ----------------
  floorEnd_goblins: { lines: [
    { speaker: 'narrador', text: 'O Goblin Maior cai de joelhos. A coroa torta rola pelo chão.' },
    { speaker: 'goblinRei', text: 'Não... leva... O selo é NOSSO! Ele fala com a gente à noite...' },
    { speaker: 'narrador', text: 'Entre moedas e ossos, um amuleto de pedra pulsa com luz azulada. O mesmo círculo partido.' },
    { speaker: 'narrador', text: 'Ele está morno. Como se algo, muito abaixo, respirasse através dele.' },
  ] },
  cityAfter_goblins: { lines: [
    { speaker: 'anselmo', text: 'Esse amuleto... Posso segurá-lo?' },
    { speaker: 'anselmo', text: 'Está quente. Os goblins não roubaram isto de ninguém: encontraram lá embaixo e passaram a adorá-lo.' },
    { speaker: 'anselmo', text: 'É um pedaço do selo. Se ele está se soltando das paredes da dungeon, é porque algo o empurra por dentro.', memory: 'selo', choices: [
      { id: 'destruir', text: 'Não é melhor destruí-lo?', reply: 'Destruir um selo é abrir a porta que ele guarda. Não, meu amigo.' },
      { id: 'guardar', text: 'Guarde-o na igreja.', reply: 'É o que farei. Ninguém toca nele sem minha bênção.' },
      { id: 'perguntar', text: 'O que ele prende, afinal?', reply: 'Gostaria de saber. Os registros da minha ordem falam só "daquilo que espera além do portão".' },
    ] },
    { speaker: 'anselmo', text: 'Conte isso ao Professor Aldo. Ele estuda a magia dessa dungeon há anos, vai querer saber de cada detalhe.' },
  ] },

  // ---------------- capítulo III: Terras Selvagens ----------------
  floorEnd_wilds: { lines: [
    { speaker: 'narrador', text: 'O último troll desaba, e o chão das Terras Selvagens treme. Não por causa dele.' },
    { speaker: 'narrador', text: 'Você percebe tarde demais: os orcs e trolls nunca atacaram a cidade. Estavam fugindo. Barricaram a escada que desce com os próprios corpos.' },
    { speaker: 'narrador', text: 'Lá de baixo sobe um calor seco, cheiro de enxofre... e o som de asas enormes batendo no escuro.' },
  ] },
  cityAfter_wilds: { lines: [
    { speaker: 'creiton', text: 'Então o boato é verdade. Você abriu caminho pelas Terras Selvagens.' },
    { speaker: 'creiton', text: 'Olha esta presa de orc que o Barnabé me vendeu. Vê essas marcas? São de martelo. Martelo de ferreiro.' },
    { speaker: 'creiton', text: 'Meu avô contava de uma forja antiga. De heróis que desceram pelo portão com armas feitas pra fechar o que estava aberto.', memory: 'forja', choices: [
      { id: 'lenda', text: 'É só uma lenda.', reply: 'Lenda, é? Então me explica por que o Rei Slime carregava um machado com a marca da minha família.' },
      { id: 'armas', text: 'Você consegue forjar armas assim?', reply: 'Com material de verdade? Consigo. Traga o que aquela dungeon tiver de melhor.' },
      { id: 'avo', text: 'Seu avô desceu lá?', reply: 'Desceu. E voltou sem uma mão e sem vontade de falar do assunto. Agora eu entendo por quê.' },
    ] },
    { speaker: 'creiton', when: 'primeiraVitoria=orgulho', text: 'E o Anselmo me contou que você achou o pântano "fácil". Ótimo. Lá embaixo é fogo.' },
    { speaker: 'creiton', when: 'creiton=caro', text: 'E antes que reclame do preço de novo: ferro bom derrete com dragão. O meu não.' },
    { speaker: 'creiton', text: 'Seja o que for que está lá embaixo, não é coisa que se enfrente com uma espada de loja.' },
  ] },

  // ---------------- capítulo IV: Dragão ----------------
  floorEnd_dragons: { lines: [
    { speaker: 'narrador', text: 'O dragão tomba, e as chamas do andar inteiro se apagam de uma só vez.' },
    { speaker: 'dragao', text: 'Pequeno... humano... Você acha que me venceu?' },
    { speaker: 'dragao', text: 'Eu não guardava este andar de vocês. Eu guardava vocês... do que está abaixo.' },
    { speaker: 'dragao', text: 'O selo... se parte... Eles já estão... na porta.' },
    { speaker: 'narrador', text: 'Os olhos do dragão se apagam. Sob o seu corpo, uma última escadaria desce até uma porta de pedra negra, rachada ao meio.' },
  ] },
  cityAfter_dragons: { lines: [
    { speaker: 'anselmo', text: 'Sente-se, {nome}. Há algo que eu devia ter contado antes.' },
    { speaker: 'anselmo', text: 'Minha ordem não construiu esta igreja por acaso. Ela foi erguida em frente ao portão... para vigiá-lo.' },
    { speaker: 'anselmo', text: 'Há muitas gerações, heróis desceram e selaram o que vive no fundo. O preço foi alto. A cidade escolheu esquecer.' },
    { speaker: 'anselmo', text: 'Achei que o selo duraria pra sempre. Eu estava errado, e foi você quem pagou pelo meu silêncio.' },
    { speaker: 'anselmo', when: 'primeiraVitoria=humilde', text: 'Você disse, lá no começo, que tinha tido sorte. Não foi sorte. Foi você.' },
    { speaker: 'anselmo', when: 'primeiraVitoria=orgulho', text: 'Você disse que o pântano foi fácil. Espero que ainda pense assim quando descer.' },
    { speaker: 'anselmo', when: 'primeiraVitoria=geleia', text: 'Lembra quando voltou coberto de geleia? Parece que foi há uma vida.' },
    { speaker: 'anselmo', text: 'Eu não tenho o direito de pedir mais nada. Mas preciso.', memory: 'confissao', choices: [
      { id: 'perdoar', text: 'Você fez o que achou certo.', reply: 'Obrigado. Eu não mereço, mas obrigado.' },
      { id: 'bravo', text: 'Você devia ter me contado.', reply: 'Devia. E vou carregar isso comigo.' },
      { id: 'foco', text: 'Como eu fecho o portão?', reply: 'Os registros dizem: derrote quem segura a porta aberta. O resto, o selo faz sozinho.' },
    ] },
    { speaker: 'anselmo', when: 'selo=destruir', text: 'E, por favor... desta vez, nada de pensar em destruir o selo.' },
    { speaker: 'anselmo', text: 'Vá. E volte. A cidade precisa de você inteiro.' },
  ] },

  // ---------------- capítulo V: Demônios (final) ----------------
  floorEnd_demons: { lines: [
    { speaker: 'narrador', text: 'O último demônio se desfaz em cinzas, e a porta de pedra negra geme.' },
    { speaker: 'narrador', text: 'Pedaço por pedaço, o círculo partido se recompõe no chão: o amuleto dos goblins, a marca do rei do pântano, as brasas do dragão.' },
    { speaker: 'narrador', text: 'O selo se fecha com um estalo que você sente nos ossos.' },
    { speaker: 'narrador', text: 'Por um instante, do outro lado da porta, algo encosta na pedra. E espera.' },
  ] },
  cityAfter_demons: { lines: [
    { speaker: 'narrador', text: 'Na manhã seguinte, as janelas da cidade se abrem uma a uma.' },
    { speaker: 'barnabe', text: '{nome}! A loja nunca esteve tão cheia! Tem gente voltando de todo lado!' },
    { speaker: 'barnabe', when: 'barnabe=pagar', text: 'E, como prometi lá no começo: meus melhores preços. Pra sempre. Bom... quase sempre.' },
    { speaker: 'creiton', text: 'A forja não para mais. E adivinha quem é o primeiro da fila? Você, é claro.' },
    { speaker: 'creiton', when: 'forja=lenda', text: 'Ainda acha que era só uma lenda?' },
    { speaker: 'anselmo', text: 'O selo está fechado. Por enquanto.', memory: 'final', choices: [
      { id: 'porEnquanto', text: 'Por enquanto?', reply: 'Selos não duram pra sempre. Mas hoje... hoje a gente comemora.' },
      { id: 'voltar', text: 'Se ele abrir, eu desço de novo.', reply: 'Eu sei que desce. É exatamente disso que eu tenho medo. E orgulho.' },
    ] },
    { speaker: 'anselmo', when: 'confissao=bravo', text: 'E... obrigado por não ter ido embora, mesmo com raiva de mim.' },
    { speaker: 'anselmo', text: 'Obrigado, {nome}. Por tudo.' },
    { speaker: 'narrador', text: 'A dungeon continua lá, além do portão, e os monstros ainda rondam seus andares. Mas agora a cidade sabe o nome de quem a protege.' },
    { chapter: 'Fim', title: 'Beyond the Gate', text: 'Obrigado por jogar! A história continua em uma próxima atualização.' },
  ] },
};

// ---------------- Madame Morgana (ver WitchModule, js/witch.js) ----------------
// RASCUNHO pra revisão, igual à história acima.
Object.assign(DIALOGUES, {
  witchIntro: { lines: [
    { speaker: 'morgana', text: 'Hehehe... finalmente alguém com coragem de falar comigo depois que escurece.' },
    { speaker: 'morgana', text: 'Madame Morgana, ao seu dispor. Leio a lua, as cinzas e, às vezes, as pessoas.', memory: 'morgana', choices: [
      { id: 'respeito', text: 'Muito prazer, madame.', reply: 'Educado! Que raridade nesta cidade.' },
      { id: 'desconfia', text: 'O Anselmo sabe que você está aqui?', reply: 'O Anselmo sabe de muitas coisas. E finge não saber de outras tantas.' },
      { id: 'sapo', text: 'Você é bruxa de verdade? Prove.', reply: 'Quer virar sapo? ... Não? Então não me desafie, querido. Hehehe.', achievement: 'quaseSapo' },
    ] },
    { speaker: 'morgana', text: 'Essa dungeon transborda magia. Quem sabe misturar as coisas certas... transforma sobra em tesouro.' },
    { speaker: 'morgana', text: 'Traga-me uns ingredientes e eu te mostro como. Mas só à noite: de dia eu durmo.' },
  ] },
});

// textos soltos da bruxa, montados em conversa na hora (ver WitchModule.talk)
const WITCH_TEXTS = {
  // saudação ao clicar nela de novo (a 1ª que bater o `when` vale)
  greetings: [
    { when: 'morgana=sapo', text: 'Voltou, pequeno sapo? Hehehe. Brincadeira... por enquanto.' },
    { when: 'morgana=desconfia', text: 'O Anselmo mandou você me vigiar? Diga a ele que mandei lembranças.' },
    { text: 'Uma noite linda pra misturar coisas perigosas, não acha?' },
  ],
  // o que ela diz do selo, por capítulo (índice = state.story.chapter)
  lore: [
    'A lua anda nervosa. Algo embaixo da cidade se mexe, e não é minhoca.',
    'O círculo partido... O Anselmo te contou? Claro que não contou tudo. Nunca conta.',
    'Os goblins adoravam o selo porque ele *canta*. Eu também ouço. Faz tempo.',
    'Os bichos fogem antes da gente. Se os trolls correram, é porque o que vem é pior.',
    'O dragão falou com você? Dragões nunca mentem. Só escolhem muito bem o que dizer.',
    'Fechado... por enquanto. A lua continua nervosa, querido. E eu também.',
  ],
  // anúncio de cada pedido dela (chave = QUEST_DEFS.key)
  questIntro: {
    witchMoonHerbs: 'Primeiro, o básico: *30 Geleias* e *12 Compostos de Slime*. Traga numa noite dessas e eu te ensino a Alquimia.',
    witchSealEcho: 'Esses amuletos goblins... Traga *6 Amuletos* e *3 Selos*, e depois suba na *torre de vigia* numa noite. Quero saber o que você ouve lá de cima.',
    witchTrollBlood: 'Trolls fecham qualquer ferida. Derrote *40 trolls* e me traga *15 Peles*. Quero ver o sangue deles no meu caldeirão.',
    witchDragonEmber: 'Preciso de uma brasa que não se apague: *10 Escamas de Dragão*, *30 de Lagarto de Fogo*, e acenda tudo na *bigorna do Ferreiro* à noite. Não conte ao Creiton.',
    witchShadowVeil: 'O selo fechou, mas eu não confio em portas. Traga *20 Essências das Sombras* e *5 Chifres*. Vou costurar um véu.',
  },
};

// cartão de título de cada capítulo (tocado ao começar o jogo e depois de cada cityAfter_*)
for(const ch of STORY_CHAPTERS){
  DIALOGUES['chapter_' + ch.dungeon] = { lines: [{ chapter: ch.num, title: ch.title, text: ch.text }] };
}
