# Validação de Mercado — Igni (kit de entrevista + demo)

> Para você levar a campo. A pesquisa ([08](08_pesquisa_mercado.md)) provou que o ESPAÇO EM BRANCO
> existe (ninguém responsabiliza o atraso). Não provou que a retífica PAGA por isso. Este kit fecha
> esse buraco com 3–5 entrevistas reais ANTES de investir em escala (M7/M8) ou em venda.
> Regra de ouro da entrevista: **você fala 20%, ouve 80%. Não venda. Aprenda.**

## 0. O que estamos testando (as 3 hipóteses que decidem o produto)
| # | Hipótese | Se for FALSA, muda o quê |
|---|---|---|
| **H1 — Dor de adoção** | "O sistema atual (Certtus/planilha/caderno) é complicado e a equipe de chão não usa." | Se já usam bem, nossa aposta na *simplicidade* perde força. |
| **H2 — Dor do atraso/responsabilização** | "O atraso gera atrito com o cliente, e hoje não há como mostrar de quem é a bola; isso custa ligações e confiança." | Se não dói, nosso *único diferencial verificado* não vende. |
| **H3 — Disposição a pagar** | "Pagariam um SaaS mensal por um sistema simples que a equipe usa + status honesto pro cliente." | Define pricing e se há negócio. |

**O viés a evitar:** perguntas que induzem o "sim". Não pergunte "você gostaria de ver de quem é a bola?" (todo mundo diz sim). Pergunte sobre o **passado concreto** ("da última vez que um cliente reclamou de atraso, o que aconteceu?").

---

## 1. Roteiro de entrevista (45 min, presencial ou call)

### Abertura (2 min)
"Estou estudando como retíficas tocam a oficina no dia a dia, não vim vender nada. Queria entender o seu fluxo e seus perrengues. Pode falar à vontade, não há resposta certa."

### Bloco A — O fluxo real, hoje (10 min) [mapeia o terreno]
1. Me conta como uma OS anda aqui, da entrada do motor até a entrega. Quem toca o quê?
2. Como vocês sabem, agora, onde está cada serviço e o que está parado? (caderno? quadro? sistema? cabeça?)
3. Quantos motores vocês tocam por dia/semana? Quantas pessoas no chão?

### Bloco B — Adoção do sistema atual (8 min) [testa H1]
4. Vocês usam algum sistema hoje? Qual? Há quanto tempo?
5. Quem da equipe de fato abre o sistema no dia? E quem **não** abre? Por quê?
6. Tem alguma parte que vocês deixaram de usar ou que ficou no caderno/WhatsApp mesmo? Por quê?
   *(ouça: "complicado", "lento", "ninguém mexe" = sinal de H1 verdadeira)*

### Bloco C — Atraso e o cliente (12 min) [testa H2, o coração]
7. Me conta a **última vez** que um cliente ligou cobrando um serviço atrasado. Como foi?
8. Quando atrasa, normalmente a causa é o quê? (peça que não chegou? cliente que demorou a aprovar? retrabalho? capacidade?)
9. Hoje, quando a culpa do atraso é do cliente (peça dele, demora na aprovação), vocês conseguem **mostrar** isso a ele? Como?
10. Quanto tempo por dia a recepção/você gasta respondendo "e aí, ficou pronto?"
11. Já perdeu cliente ou levou bronca por causa de atraso que não foi culpa de vocês?
    *(ouça: frustração com "levar a culpa" = H2 verdadeira e forte)*

### Bloco D — A reação à ideia (8 min) [só agora, e com cuidado]
"Deixa eu te mostrar uma coisa rápida e você me diz se faz sentido ou se é bobagem." → **demo guiada (seção 2)**
12. (após a demo) O que disso resolveria um problema seu de verdade? O que é inútil?
13. Se isso existisse e a equipe usasse, mudaria alguma coisa no seu dia?

### Bloco E — Disposição a pagar (5 min) [testa H3]
14. Hoje você paga por software de gestão? Quanto, mais ou menos?
15. Por um sistema simples que a equipe de fato usa + um link de status honesto pro cliente, o que seria um preço justo por mês? O que seria caro demais?
    *(não diga um número primeiro; deixe a pessoa ancorar)*

### Fechamento
"Isso me ajudou demais. Posso te procurar de novo quando tiver uma versão pra você testar de graça?" → **registra o piloto potencial.**

---

## 2. Demo guiada (3 min, roteiro) — mostre o DIFERENCIAL, não as features comuns
> Acesse https://igni-app-production.up.railway.app · login `dev@igni.app` / `IgniDev!2026`.
> **NÃO** comece pelo painel ("mais um dashboard"). Comece pela dor.

1. **Abra o detalhe de uma OS atrasada/travada.** Aponte o bloco grande **"DE QUEM É A BOLA"**: *"Olha, aqui o sistema diz, sem rodeio, que a bola está com o cliente porque a peça dele não chegou. Honesto."* (este é o momento que importa)
2. **Mostre o link do cliente** (orçamento → enviar). Abra o **portal** numa aba: *"O cliente abre isso no celular, vê o estágio e de quem é a bola. Ele para de te ligar."*
3. **Volte ao painel** e aponte a barra **"Últimos 30 dias · de quem foi a bola"**: *"No fim do mês, você mostra pro cliente reclamão que 60% do atraso foi peça que ele demorou a mandar."*
4. **Pare.** Não mostre orçamento/triagem/realtime a fundo (é higiene, todo mundo tem). Pergunte: *"isso resolve algo seu?"*

**O que NÃO fazer na demo:** não fale de "tempo real", "multi-tenant", "RLS", "razão crítica". Fale de **ligação que para de tocar** e **bronca que deixa de levar**.

---

## 3. Como ler os resultados (decisão, não coleta)
- **3+ de 5** descrevem espontaneamente a dor de "levar a culpa do atraso" (Bloco C) → **H2 confirmada, siga.**
- **3+ de 5** dizem que a equipe não usa o sistema atual de verdade → **H1 confirmada.**
- Faixa de preço repetida entre os entrevistados → âncora de **pricing** (calibrar o "premium da simplicidade", acima do piso R$79,90 do mercado).
- **Sinal de morte:** se ninguém se importa com "de quem é a bola" e todos amam o Certtus → repensar o diferencial antes de gastar mais.

## 4. Onde isto trava o roadmap
- **Não construir M7 (WhatsApp) nem M8 (templates) antes** destas entrevistas — são escala, e só fazem sentido se H1/H2/H3 derem positivo.
- Se H3 (pagar) for fraco mas H1/H2 fortes → modelo pode ser freemium/por-painel, não SaaS por usuário.
- 1–2 entrevistados viram **pilotos gratuitos** (dogfooding na retífica real = a prova final).
