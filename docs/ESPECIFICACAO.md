# Survivor: especificação do sistema

Versão 0.1, 25/11/2026. Rascunho para aprovação antes de começar o código.

## 1. O que o sistema faz

A pessoa responde uma anamnese, escolhe um objetivo e recebe uma meta diária de calorias e macronutrientes, um programa de caminhada, uma série de musculação e uma série de calistenia. Durante o programa, o sistema registra o que ela come e o que ela faz, puxa os dados do iPhone (e do relógio, se houver) e ajusta as metas a cada 14 dias conforme o resultado real.

Plataforma escolhida: web app instalável (PWA) aberto no Safari do iPhone, com uma automação do app Atalhos enviando os dados do Apple Saúde para o servidor.

## 2. Anamnese (cadastro inicial)

### 2.1 Dados básicos
- Sexo, data de nascimento, altura, peso atual (ou o último peso vindo do Saúde).
- Circunferência da cintura (fita métrica, na altura do umbigo).
- Peso-alvo e prazo desejado. O sistema avisa quando o prazo pede um ritmo acima do seguro.
- Rotina: profissão sedentária ou ativa, passos médios atuais (medidos nos primeiros 7 dias pelo iPhone).

### 2.2 Objetivo
Uma escolha entre: perda de peso, manutenção, ganho de massa muscular e ganho de peso.

### 2.3 Triagem de saúde (baseada no questionário PAR-Q+)
Perguntas de sim ou não:
1. Algum médico já disse que você tem problema no coração ou pressão alta?
2. Sente dor no peito em repouso ou ao fazer esforço?
3. Já perdeu o equilíbrio por tontura ou desmaiou nos últimos 12 meses?
4. Tem diagnóstico de outra doença crônica (diabetes, doença renal, osteoporose, etc.)?
5. Toma remédio para pressão, diabetes ou coração? Quais?
6. Tem problema de articulação, coluna ou osso que piora com exercício?
7. Algum médico disse que você só deve fazer atividade física com supervisão?

Qualquer "sim", ou idade a partir de 60 anos, ativa o modo cauteloso: o sistema recomenda liberação médica, começa os programas no nível 1, mostra o campo de pressão arterial na tela Hoje e libera o registro de tontura ou mal-estar.

### 2.4 Medicamentos
A pessoa escolhe os remédios numa lista (nome comercial ou princípio ativo, com dose). O sistema classifica cada um e liga regras de segurança. Ele nunca sugere mudar dose ou parar remédio: só ajusta metas, mostra avisos e leva as informações para o relatório do médico.

| Classe (exemplos) | Regras no sistema |
|---|---|
| Diuréticos (indapamida, hidroclorotiazida, espironolactona, furosemida) | Meta de água "conforme orientação médica", sem a regra de 35 ml/kg. Sódio sem meta mínima de restrição. Aviso de calor nos dias quentes e sugestão de caminhar cedo ou à noite. |
| IECA ou BRA (perindopril, enalapril, losartana) junto com espironolactona | Aviso para não usar sal light ou substitutos com cloreto de potássio nem suplemento de potássio sem orientação. Lembrete de exames de potássio e creatinina. |
| Anti-hipertensivos em geral (incluindo anlodipino) | Campo de pressão na tela Hoje, lembrete de medir 2 ou 3 vezes por semana, alerta de tontura e dica de levantar devagar. A cada 5 kg perdidos, sugere mostrar o relatório de pressão ao médico. |
| Betabloqueadores (atenolol, metoprolol, carvedilol) | Zonas de frequência cardíaca desligadas. A intensidade passa a ser controlada pelo teste da fala e pelo esforço percebido. |
| Antidepressivos ISRS (sertralina, fluoxetina, escitalopram) junto com diurético, ou a partir dos 65 anos | Sem meta alta de água. Alerta de sintomas de sódio baixo: náusea, dor de cabeça, confusão, tontura. |
| Remédios que reduzem o apetite (bupropiona, semaglutida, tirzepatida) | Alerta mais cedo quando o registro fica abaixo do piso de calorias. Prioridade de proteína nas refeições. |
| Insulina e sulfonilureias (glibenclamida, gliclazida) | Alerta de hipoglicemia antes e depois do exercício e quando a refeição registrada for pequena. Lembrete de que a dose pode precisar de ajuste médico conforme o peso cai. |
| Qualquer remédio de pressão, diabetes ou rim combinado com proteína acima de 1,6 g/kg | A proteína começa em 1,6 g/kg do peso-alvo. Os 2,0 g/kg ficam liberados quando a pessoa marca que o médico aprovou depois de exames de função renal. |

### 2.5 Treino
- Onde treina: academia, em casa com equipamento, em casa sem equipamento.
- Equipamentos disponíveis: barra fixa, halteres (faixa de peso), elásticos, banco, mochila com carga.
- Experiência: nunca treinou, já treinou e parou, treina hoje.
- Dias por semana disponíveis e duração por sessão.

## 3. Cálculo das metas

### 3.1 Gasto estimado
- Metabolismo basal (Mifflin-St Jeor):
  - Homem: 10 × peso + 6,25 × altura(cm) − 5 × idade + 5
  - Mulher: 10 × peso + 6,25 × altura(cm) − 5 × idade − 161
- Gasto do dia a dia: basal × 1,2 (sedentário) ou × 1,375 (trabalho ativo).
- Exercício planejado: somado à parte, pelo MET de cada atividade (caminhada leve ≈ 3, calistenia moderada ≈ 4, musculação ≈ 3,5), descontando o gasto de repouso: (MET − 1) × peso × horas.
- Depois de 14 dias de registro, o gasto real calculado pelos dados (seção 3.4) substitui essa estimativa.

### 3.2 Regras por objetivo

| Objetivo | Calorias | Proteína | Gordura | Ritmo esperado |
|---|---|---|---|---|
| Perda de peso | gasto − 20% | 2,0 g × peso-alvo | 0,8 g × peso-alvo | −0,5% a −1% do peso por semana |
| Manutenção | gasto | 1,6 g × peso atual | 0,9 g × peso atual | ±0,25% por semana |
| Ganho de massa muscular | gasto + 10% | 2,0 g × peso atual | 0,9 g × peso atual | +0,25% a +0,5% por semana |
| Ganho de peso | gasto + 15% | 1,8 g × peso atual | 1,0 g × peso atual | +0,5% a +0,75% por semana |

Para todos os objetivos:
- Carboidrato = (calorias − proteína × 4 − gordura × 9) ÷ 4.
- Fibra = 14 g por 1.000 kcal.
- Água = 35 ml × peso atual, exceto quando a seção 2.4 desliga essa regra.
- Sódio: até 2.000 mg, exceto quando a seção 2.4 desliga essa regra.

Limites de segurança:
- Piso de calorias: 1.600 kcal para homens e 1.300 kcal para mulheres. O ajuste automático nunca passa desse valor.
- Gordura nunca abaixo de 0,6 g/kg.
- Se a triagem indicou doença renal, a proteína fica limitada a 1,2 g/kg até liberação médica.

Exemplo (usuário atual: homem, 64 anos, 1,78 m, 114 kg, meta 99 kg, perda de peso):
basal 1.938 kcal; gasto total ≈ 2.750 kcal; meta 2.200 kcal; gordura 79 g; fibra ≈ 30 g. Como ele toma perindopril + indapamida + anlodipino, espironolactona, sertralina e bupropiona, a seção 2.4 muda três coisas: proteína começa em 158 g (1,6 × 99) até liberação médica, com carboidrato ≈ 214 g; água conforme orientação médica, sem a meta de 4 litros; aviso sobre sal light e potássio.

### 3.3 Distribuição nas refeições
Proteína dividida em 3 a 5 refeições, com pelo menos 0,4 g/kg em cada uma (relevante a partir dos 60 anos, quando o músculo aproveita pior doses grandes de uma vez).

### 3.4 Ajuste adaptativo (a cada 14 dias)
1. Tendência do peso: média móvel exponencial dos pesos diários.
2. Gasto real = média de calorias comidas − (variação da tendência em kg × 7.700 ÷ dias).
3. Nova meta = gasto real ajustado pela regra do objetivo.
4. A mudança por ciclo fica limitada a 150 kcal, para cima ou para baixo.
5. O ajuste não roda se houver menos de 10 dias com refeições registradas no período. Nesse caso, o sistema pede mais registro em vez de mudar a meta.

### 3.5 Alertas
- Menos de 1.500 kcal registradas por 3 dias seguidos.
- Perda acima de 1,2 kg por semana por 2 semanas (perda de peso) ou ganho acima do teto (ganho).
- Proteína abaixo de 80% da meta por 5 dias.
- Tontura registrada: sugere conferir pressão, água e sal, e falar com o médico se repetir.
- Pressão abaixo de 100/60 com sintomas, ou acima de 160/100: recomenda contato médico.

## 4. Programa de caminhada

- Semana 0: medição dos passos atuais, sem meta.
- Meta inicial: passos médios atuais + 1.500, ou 20 minutos contínuos.
- Progressão: +10% de passos ou +10 minutos por semana, até chegar a 60 minutos diários (~6.000 a 7.000 passos só na caminhada).
- Intensidade sem relógio: teste da fala (dá para conversar, mas não cantar) e cadência entre 90 e 110 passos por minuto, calculada pelo iPhone.
- Com relógio: zona 2 de frequência cardíaca, entre 60% e 70% da máxima estimada (máxima ≈ 208 − 0,7 × idade).
- No modo cauteloso, a progressão para em qualquer semana com tontura ou dor registrada.

## 5. Musculação de força

Montada a partir do local e dos equipamentos da anamnese.

- Para quem treina em academia (caso do usuário atual), a série usa máquinas guiadas nas primeiras 4 a 6 semanas (leg press, cadeira flexora, supino máquina, remada sentada, puxada frontal, desenvolvimento máquina) e só depois passa para pesos livres. Máquinas são mais seguras para quem está começando ou tem mais de 60 anos.
- Estrutura: corpo inteiro, 2 ou 3 sessões por semana em dias não seguidos (treino A e treino B alternados).
- Cada sessão tem 5 ou 6 exercícios: um de joelho dominante (agachamento ou leg press), um de quadril dominante (levantamento romeno ou ponte), um empurrar horizontal, um puxar horizontal, um empurrar vertical ou puxar vertical, e um de core.
- Séries e repetições: 2 a 3 séries de 8 a 12 repetições, parando com 2 ou 3 repetições "na reserva" (esforço percebido 7 a 8 de 10).
- Progressão por dupla progressão: quando todas as séries chegam a 12 repetições com boa técnica, a carga sobe (+2,5 kg nos membros inferiores, +1 kg nos superiores, ou a variação mais difícil) e as repetições voltam para 8.
- Semana de descarga a cada 6 semanas: metade das séries.
- Registro por série: carga, repetições e esforço percebido. O sistema mostra a última sessão como referência e calcula a força estimada (1RM pela fórmula de Epley) para o gráfico de evolução.

## 6. Calistenia de estilo militar

Baseada nos testes físicos militares (flexão de braço, abdominal, barra fixa e corrida ou caminhada rápida), adaptada por níveis.

- Teste inicial: número máximo de repetições com boa técnica em flexão (ou a regressão possível), abdominal em 1 minuto, prancha em segundos, barra fixa ou remada invertida, agachamento livre em 1 minuto.
- Níveis de cada movimento, do mais fácil ao mais difícil:
  - Flexão: na parede → na mesa → nos joelhos → completa → com pés elevados.
  - Barra: remada na mesa ou no elástico → barra negativa (só a descida) → barra com elástico → barra completa.
  - Agachamento: sentar e levantar da cadeira → agachamento livre → avanço → agachamento búlgaro.
  - Core: prancha nos joelhos → prancha → prancha com elevação de braço; abdominal remador.
- Sessão de 30 minutos em circuito: 5 minutos de aquecimento, 20 minutos de trabalho (3 a 4 voltas com 50% a 60% do máximo do teste em cada exercício), 5 minutos de volta à calma.
- Reteste a cada 4 semanas. Se o máximo subir, as metas do circuito sobem junto. O nível muda quando a pessoa faz 3 séries de 12 a 15 repetições do nível atual.
- Frequência: nos dias sem musculação. Com musculação 3 vezes por semana, a calistenia fica em 2 ou 3 dias, com um dia livre (só caminhada).

## 7. Semana padrão (exemplo com musculação 3 vezes)

| Seg | Ter | Qua | Qui | Sex | Sáb | Dom |
|---|---|---|---|---|---|---|
| Musculação A + caminhada | Calistenia + caminhada | Musculação B + caminhada | Calistenia + caminhada | Musculação A + caminhada | Calistenia + caminhada | Só caminhada |

## 8. Dados do iPhone e do relógio

A automação do Atalhos roda a cada 2 horas e às 23h, lê o Apple Saúde e envia para o servidor:

| Dado | Fonte | Uso |
|---|---|---|
| Passos, distância, andares | iPhone | meta de caminhada, gasto |
| Energia ativa | iPhone / relógio | conferência do gasto |
| Cadência e velocidade de caminhada | iPhone | intensidade da caminhada |
| Peso, gordura corporal, massa magra | balança (OKOK → Saúde) | tendência e ajuste da meta |
| Sono | iPhone (Sono) / relógio | alerta de sono curto |
| Frequência cardíaca em repouso, VFC | relógio | sinal de recuperação ou excesso de treino |
| Frequência durante o exercício | relógio | zona da caminhada |
| Pressão arterial | aparelho compatível ou registro manual | segurança |

Cada usuário tem um token pessoal. O atalho envia os dados para um endpoint do servidor com esse token, e o servidor ignora registros repetidos.

## 9. Registro de refeições

A foto do prato é a forma principal de registro. Texto livre, voz e código de barras são alternativas.

### 9.1 Fluxo da foto
1. A pessoa toca em "Registrar refeição", tira a foto (ou escolhe uma da galeria) e o sistema sugere o tipo de refeição pelo horário (café, almoço, lanche, jantar, ceia). Ela pode acrescentar uma frase opcional, como "o arroz é integral" ou "frango grelhado sem óleo".
2. A foto vai para a API do Claude, que devolve uma lista estruturada: cada alimento identificado, a porção estimada em gramas, o modo de preparo provável (frito, grelhado, cozido) e um grau de confiança.
3. O servidor procura cada alimento na tabela TACO e calcula calorias, proteína, gordura, carboidrato e fibra pela porção estimada. Quando o alimento não está na TACO, usa o Open Food Facts. Só quando nenhuma das duas tem o alimento o valor vem da estimativa da IA, e o item fica marcado como "estimado".
4. A tela de conferência mostra cada item com sua porção e seus valores, e o total do prato:
   - arroz branco, 150 g: 192 kcal, 3,8 g de proteína, 0,3 g de gordura, 42 g de carboidrato, 2,4 g de fibra;
   - feijão carioca, 100 g: 76 kcal, 4,8 g de proteína, 0,5 g de gordura, 13,6 g de carboidrato, 8,5 g de fibra;
   - e assim por diante.
   A pessoa ajusta a porção com um controle deslizante ou botões (pequena, média, grande), troca um alimento identificado errado, apaga ou adiciona itens. Itens com confiança baixa aparecem destacados para conferência.
5. Ao salvar, a refeição entra no histórico com a foto, a hora, os itens e os totais, e a tela Hoje atualiza o que falta para a meta do dia.

### 9.2 Histórico
- Linha do tempo por dia, com a foto de cada refeição e os totais.
- Qualquer refeição pode ser aberta e corrigida depois. Os totais do dia e os indicadores são recalculados.
- "Repetir refeição" e favoritos registram com um toque o que a pessoa come sempre.
- Dados guardados por item: alimento, código TACO ou Open Food Facts, gramas, calorias, proteína, gordura, carboidrato, fibra, sódio e origem do valor (tabela ou estimado).

### 9.3 Precisão
A estimativa de porção por foto erra, em média, entre 15% e 30%, principalmente em óleo, molhos, recheios e pratos misturados (lasanha, estrogonofe). Para reduzir o erro:
- Fotografar de cima, com o prato inteiro e um objeto de referência visível (garfo ou celular ao lado).
- Informar na frase opcional o que a foto não mostra: óleo usado, açúcar no café, molho.
- Quem quiser precisão maior pode pesar a comida numa balança de cozinha e digitar os gramas na tela de conferência.
- O ajuste adaptativo da meta (seção 3.4) compensa o erro que se repete, porque compara o que foi registrado com o que o peso fez de verdade.

### 9.4 Outras formas de registro
- Texto ou voz: "2 ovos mexidos, 1 pão francês e café com leite". Passa pelo mesmo processo da etapa 3 em diante.
- Código de barras: lê o produto no Open Food Facts e pede só a quantidade.

## 10. Acompanhamento

### 10.1 Tela Hoje
Calorias restantes, macros, água, passos e minutos de caminhada, treino do dia com check, botão de registrar peso, pressão ou sintoma.

### 10.2 Indicadores consolidados
- Peso: tendência, variação semanal e total, previsão de chegada ao peso-alvo.
- Cintura: semanal.
- Composição: gordura corporal e massa magra (tendência).
- Aderência: % de dias dentro da meta de calorias (±10%), % de dias com proteína atingida, % de treinos feitos.
- Nutrição: médias semanais de calorias, proteína, fibra, água e sódio.
- Atividade: média de passos e minutos de caminhada.
- Força: 1RM estimado por exercício.
- Calistenia: resultados dos retestes e nível atual de cada movimento.
- Recuperação: sono médio, frequência em repouso (com relógio).
- Segurança: histórico de pressão e sintomas.

### 10.3 Relatório
Relatório quinzenal (junto com o ajuste da meta) e relatório em PDF para levar ao médico com peso, pressão, sintomas e treinos do período.

## 11. Arquitetura

- Front-end: Next.js (App Router) + Tailwind, instalável como PWA, com câmera para as fotos.
- Back-end: Supabase self-hosted já existente (login, banco Postgres com Row Level Security, armazenamento das fotos). As rotas de servidor do Next.js recebem os dados do Atalhos e fazem as chamadas de IA, para não depender das Edge Functions na instalação própria.
- Dados nutricionais: tabela TACO carregada no banco; Open Food Facts consultado por código de barras.
- Hospedagem: VPS própria com Easypanel (app Next.js em contêiner, HTTPS pelo próprio Easypanel). Backups diários do Postgres fora da VPS.

### 11.1 Provedores de IA

A IA só identifica os alimentos e estima as porções. Os números de calorias e nutrientes vêm sempre da TACO e do Open Food Facts (seção 9). Por isso trocar de provedor muda pouco o resultado, e o sistema pode aceitar vários.

Situação de cada opção pesquisada em novembro de 2026:

| Opção | Situação | Uso no sistema |
|---|---|---|
| Entrar com ChatGPT (Plus ou Pro) | Existe desde o DevDay 2026 e permite usar a cota do plano em apps parceiros, mas o acesso é por convite, e apps rodando em servidor têm requisitos extras. Não há confirmação para o plano Free. | Fase futura: pedir acesso à OpenAI. Se aprovado, entra como opção de login. |
| Assinatura do Claude (Pro ou Max) | A Anthropic proíbe o uso do login da assinatura em apps de terceiros desde fevereiro de 2026. | Não é possível. Só por chave de API. |
| Conta Google com Gemini | Não existe caminho oficial para um app usar a assinatura ou a cota gratuita do usuário pelo login Google. Chave de API do Gemini em app de terceiros é permitida. | Só por chave de API. |
| Chave de API própria | Funciona com qualquer provedor. | Disponível. |

Modos que o morador escolhe em Configurações → Inteligência artificial:
1. Padrão do sistema: usa a chave do administrador, com limite diário de fotos por morador. É o modo inicial, e o morador não precisa configurar nada.
2. Minha chave: o morador escolhe o provedor (OpenAI, Anthropic, Google Gemini, ou "compatível com OpenAI" para OpenRouter, Groq, DeepSeek, Ollama e outros, com endereço base e nome do modelo) e cola a chave. O botão "Testar" envia uma foto de exemplo e mostra o resultado antes de salvar. Com chave própria, o limite diário não se aplica.
3. Entrar com ChatGPT: aparece só se a OpenAI aprovar o app.

Regras técnicas:
- Um adaptador por provedor, todos com o mesmo contrato: recebe a foto e a frase opcional e devolve a lista de alimentos no formato JSON definido pelo sistema. A resposta é validada contra o esquema antes de ser usada, e uma resposta inválida gera uma nova tentativa ou cai para o registro manual.
- O sistema avisa quando o modelo escolhido não aceita imagens. Nesse caso só o registro por texto fica disponível.
- As chaves ficam criptografadas no banco (AES-256-GCM, com a chave mestra só na variável de ambiente do servidor). Depois de salva, a chave nunca volta para o navegador; a tela mostra só os 4 últimos caracteres.
- Toda chamada registra provedor, modelo, tokens e custo estimado, para o painel do administrador e para o limite diário.
- O consentimento LGPD diz qual empresa recebe as fotos em cada modo. No modo padrão, o provedor escolhido deve ter termos que não usem os dados enviados para treinar modelos. Planos gratuitos de API podem ter regra diferente e precisam ser conferidos.

Custo estimado do modo padrão, supondo cerca de 2.500 tokens de entrada (foto e instruções) e 500 de saída por foto, para 100 moradores com 4 fotos por dia (12.000 fotos por mês):

| Modelo | Por foto | Por mês |
|---|---|---|
| Claude Haiku 5.5 | ~US$ 0,0005 | ~US$ 6 |
| Claude Sonnet 5.5 | ~US$ 0,01 | ~US$ 120 |
| Claude Opus 5.5 | ~US$ 0,02 | ~US$ 240 |

A escolha do modelo padrão sai do piloto: comparar a identificação dos alimentos em 50 a 100 fotos reais de pratos brasileiros e ficar com o mais barato que acerte o suficiente.

## 12. Fases

1. Base: convites, login, consentimento LGPD, anamnese, cálculo das metas, tela Hoje, registro manual de peso, passos e refeições por texto, painel do administrador.
2. Integração: automação do Atalhos (passos, peso, sono), registro por foto e código de barras.
3. Treinos: geração e registro das séries de musculação e calistenia, testes e progressão.
4. Acompanhamento: ajuste adaptativo, alertas, painel de indicadores, relatórios.

## 13. Uso no residencial (multiusuário)

O sistema será oferecido de graça aos moradores de um residencial no Rio de Janeiro.

### 13.1 Acesso
- Cadastro só com convite: o administrador gera um link de convite (para um morador do residencial ou para qualquer pessoa com quem queira compartilhar), e a pessoa cria a conta com e-mail ou telefone.
- O administrador pode desativar contas (por exemplo, quando alguém se muda).
- Cada morador vê apenas os próprios dados. As regras de segurança do banco (Row Level Security) garantem isso no servidor, não só na tela.

### 13.2 Papéis
| Papel | O que vê e faz |
|---|---|
| Morador | Os próprios dados, programas e relatórios. |
| Administrador | Convites, contas ativas, números agregados e anônimos (quantos usam, média de passos do residencial). Não vê peso, refeições, saúde ou treinos de ninguém. |
| Profissional parceiro (opcional) | Os dados de um morador só se ele autorizar no app, e pode cancelar a autorização quando quiser. |

### 13.3 LGPD
Dados de saúde são dados pessoais sensíveis (Lei 13.709/2018, art. 11). O sistema precisa de:
- Um controlador definido: quem responde pelos dados (o próprio criador do sistema ou a associação de moradores).
- Consentimento específico e destacado no cadastro, separado dos termos de uso, explicando quais dados são coletados, para quê e onde ficam.
- Política de privacidade e termos de uso em linguagem simples.
- Botões para o morador baixar todos os seus dados e para apagar a conta com tudo o que ela tem.
- Coleta mínima: nada de CPF, e o endereço se resume ao número da unidade.
- Fotos das refeições guardadas com acesso privado. Depois de 90 dias a foto é apagada e ficam só os números.
- Revisão desses textos por um advogado antes do lançamento.

### 13.4 Responsabilidade profissional
No Brasil, prescrever exercício é atribuição de profissional de Educação Física (CREF) e prescrever dieta é atribuição de nutricionista (CRN). Para não entrar nessa área:
- O sistema se apresenta como ferramenta educativa e de acompanhamento, com aviso claro em todas as telas de programa.
- A triagem de saúde (seção 2.3) recomenda liberação médica antes de começar sempre que houver risco.
- Se possível, um profissional de Educação Física e um nutricionista revisam as regras dos programas e das metas antes do lançamento. Moradores do residencial com essa formação são bons candidatos.

### 13.5 Android
A automação do Atalhos só existe no iPhone. Para quem usa Android:
- Fase 1: registro manual de passos e peso (o app do celular mostra os números, e o morador digita uma vez por dia).
- Fase posterior: um app pequeno de sincronização para Android, que lê o Health Connect e envia ao servidor. Publicar na Google Play tem taxa única de US$ 25, e a compilação pode ser feita na nuvem, sem Mac.

### 13.6 Facilidade para moradores mais velhos
- Fonte grande, botões grandes, poucas opções por tela, tudo em português.
- Atalho do iPhone pronto, instalado por um link do iCloud, com passo a passo em imagens.
- Sessão presencial de instalação no residencial, para ajudar quem tiver dificuldade.

### 13.7 Comunidade (opcional, só para quem quiser participar)
- Desafio mensal de passos do residencial, com ranking por apelido.
- Grupos de caminhada com horário marcado.
- Nenhum dado de peso ou saúde aparece para outros moradores.

### 13.8 Custos
| Item | Custo | Observação |
|---|---|---|
| API do Claude (fotos e textos das refeições) | cresce com o número de moradores e de fotos | limite diário de fotos por morador; texto custa menos que foto |
| Supabase self-hosted | sem custo extra | limite é o disco da VPS; fotos comprimidas e apagadas depois de 90 dias |
| VPS com Easypanel | já existe | Supabase e app no mesmo servidor |
| Domínio | ~R$ 40/ano | opcional |

O valor da API precisa ser medido no piloto, antes de abrir para todos.

### 13.9 Lançamento
1. Piloto com o criador do sistema e 5 a 10 moradores por 4 semanas.
2. Ajustes com base no uso e nos custos medidos.
3. Abertura para todo o residencial.

## 14. Decisões em aberto

- Quem é o controlador dos dados: pessoa física ou associação de moradores.
- Se há profissional de Educação Física e nutricionista para revisar as regras.
- Quantos moradores devem usar e qual a parcela com Android.
- Provedor e modelo do modo padrão de IA, e quem paga depois do piloto.
- Pedido de acesso ao "Entrar com ChatGPT" junto à OpenAI.

Este sistema não substitui acompanhamento médico ou de nutricionista e não deve ser usado para diagnóstico.
