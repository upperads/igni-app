/**
 * Conteúdo do guia "Primeiros passos" (US-17). Espelha docs/conteudo/primeiros-passos.md.
 * Voz obrigatória: prosa calma e didática, sem frases picotadas nem travessão em tudo.
 */

export interface PassoGuia {
  numero: number;
  titulo: string;
  paragrafos: readonly string[];
}

export const INTRO_TITULO = "Antes de configurar qualquer coisa";

export const INTRO: readonly string[] = [
  "O Igni nasceu para resolver uma cena que toda oficina conhece bem. Um motor entra, passa por várias mãos e, em algum momento, some no meio do processo. Ninguém sabe ao certo onde ele está, por que parou nem quanto falta para entregar, e a resposta acaba dependendo de quem você encontra no corredor. A proposta do Igni é que isso nunca mais aconteça.",
  "A ideia por trás de tudo é simples de explicar e poderosa no dia a dia. Olhando para o painel, qualquer pessoa da equipe consegue responder quatro perguntas sobre qualquer ordem de serviço: onde ela está, por que parou, o que falta e para onde vai. Quando essas quatro respostas ficam sempre visíveis, a oficina deixa de perder tempo procurando informação e passa a usar esse tempo para produzir.",
  "Este guia acompanha você nos primeiros passos, sem pressa, na ordem que faz sentido para quem está começando. Você não precisa configurar tudo de uma vez. Faça um passo, veja funcionando de verdade, e siga para o próximo quando estiver à vontade.",
];

export const PASSOS: readonly PassoGuia[] = [
  {
    numero: 1,
    titulo: "Crie a sua oficina e escolha o seu ramo",
    paragrafos: [
      "O primeiro passo é abrir a conta da sua oficina e dizer ao Igni com que tipo de trabalho você lida. Existem três pontos de partida prontos: retífica pesada e agro, retífica leve, e centro automotivo. Ao escolher o seu, o sistema já vem com as estações, as etapas e os critérios de prioridade que combinam com o seu mundo, então você começa de um lugar familiar em vez de uma tela em branco.",
      "Nada disso fica preso para sempre. O template é só um bom ponto de partida, e tudo que vier nele pode ser ajustado depois, quando você conhecer melhor o sistema.",
    ],
  },
  {
    numero: 2,
    titulo: "Confira as estações que já vieram prontas",
    paragrafos: [
      "Cada oficina trabalha por estações, como bloco, cabeçote, virabrequim e bancada de prova. O Igni já carrega as estações típicas do seu ramo na ordem em que costumam acontecer, e vale dar uma olhada nelas com calma. A pergunta a se fazer aqui é direta: essa lista descreve o caminho que uma peça percorre dentro da sua oficina?",
      "Se faltar uma estação que é importante para você, ou sobrar uma que não usa, ajuste sem receio. É esse mapa que vai aparecer no painel e organizar o trabalho de todo mundo, então ele merece refletir a sua realidade.",
    ],
  },
  {
    numero: 3,
    titulo: "Convide a sua equipe e dê a cada um o papel certo",
    paragrafos: [
      "Com o caminho do trabalho definido, chegou a hora de trazer as pessoas. Cada membro da equipe entra com um papel, e o papel decide o que ela vê e o que pode mudar. Quem está na recepção cuida das ordens e dos orçamentos, quem está na produção acompanha e avança as etapas do chão, e a gestão enxerga o todo.",
      "Essa separação existe para proteger o trabalho, não para complicar. Alguém da produção, por exemplo, não precisa nem deve mexer em valores de orçamento, e o sistema simplesmente não oferece essa opção para ele. Cada um encontra na tela exatamente aquilo que lhe cabe.",
    ],
  },
  {
    numero: 4,
    titulo: "Abra a sua primeira ordem de serviço",
    paragrafos: [
      "Agora vem o passo que dá vida ao sistema. Abra uma ordem de serviço para um trabalho real, registrando as peças que chegaram, as fotos, o veículo e o cliente. A partir desse momento aquele motor deixa de ser um motor anônimo na bancada e passa a ter um lugar claro dentro do Igni, com história e responsável.",
      "Conforme o trabalho avança pelas estações, a ordem caminha junto e vai respondendo sozinha às quatro perguntas. Você vai perceber que perguntar onde está aquele motor do cliente deixa de ser necessário, porque a resposta já está na tela.",
    ],
  },
  {
    numero: 5,
    titulo: "Compartilhe o acompanhamento com o cliente",
    paragrafos: [
      "Toda ordem de serviço gera um link próprio para o cliente. Por esse link ele acompanha o estágio do serviço e, principalmente, entende de quem é a vez de agir num dado momento. Quando a pendência é dele, como aprovar um orçamento, o link deixa isso evidente, e quando a bola está com a oficina, ele vê o trabalho andando.",
      "O efeito disso aparece rápido no telefone da recepção. A maior parte das ligações de como está o meu motor simplesmente deixa de acontecer, porque o cliente já tem essa resposta na palma da mão, atualizada a cada mudança de etapa.",
    ],
  },
  {
    numero: 6,
    titulo: "Coloque o painel na TV do setor",
    paragrafos: [
      "O último passo é também o mais bonito de ver funcionando. Coloque o painel do setor em uma TV no chão de fábrica, em modo de tela cheia. Ele mostra cada ordem na sua estação, com a cor mudando conforme o tempo passa, para que um simples olhar de longe já diga o que está em dia e o que pede atenção.",
      "No painel a equipe não preenche formulário. Quando uma etapa termina, basta um toque para a ordem avançar, e a mudança aparece para todo mundo em segundos. É a forma de manter o chão informado sem tirar ninguém do trabalho.",
    ],
  },
];

export const FECHAMENTO_TITULO = "A partir daqui";

export const FECHAMENTO: readonly string[] = [
  "Com esses passos a oficina inteira passa a enxergar a mesma realidade ao mesmo tempo. Cada mudança de etapa se propaga na hora, cada ordem responde por conta própria às quatro perguntas, e o cliente acompanha sem precisar ligar. Você vai descobrir o resto do Igni no próprio uso, com naturalidade.",
  "Se em algum momento bater a dúvida sobre o que fazer em seguida, volte a esta página. Ela fica sempre aqui, fixa no menu, exatamente para isso.",
];
