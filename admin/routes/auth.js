// Importa o módulo Express e cria um objeto Router para definir as rotas.
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");

// Middleware dummy para verificação de autenticação.
// Em vez de verificar se o usuário está logado, essa função apenas chama o próximo middleware,
// permitindo o acesso a todas as rotas protegidas sem autenticação real.
const verificarAutenticacao = (req, res, next) => {
  // Chama o próximo middleware ou rota sem realizar nenhuma verificação.
  next();
};

// Rota GET para exibir a página de login.
// Essa rota renderiza a view "login.ejs" e passa uma mensagem (se existir) para o usuário.
router.get("/admin/login", (req, res) => {
  // Recupera a mensagem armazenada na sessão, se houver.
  const message = req.session.message || "";
  // Limpa a mensagem da sessão após a leitura.
  req.session.message = "";
  // Renderiza a view "login" e passa a mensagem de feedback.
  res.render("login", { message });
});

// Rota POST para processar o login.
// Essa rota verifica as credenciais do usuário, utilizando bcrypt para comparar senhas.
router.post("/admin/login", (req, res) => {
  // Extrai email e senha enviados pelo formulário.
  const { email, password } = req.body;
  const db = req.db; // Conexão com o banco de dados disponibilizada via req.db.

  // Consulta o banco para buscar o professor com o email informado.
  db.query(
    "SELECT * FROM professor WHERE email = ?",
    [email],
    async (err, results) => {
      if (err) {
        console.error("Erro na consulta SQL:", err);
        return res.render("login", { message: "Erro no sistema" });
      }
      // Se nenhum registro for encontrado, informa que o usuário ou a senha são inválidos.
      if (results.length === 0) {
        return res.render("login", { message: "Usuário ou senha inválidos" });
      }
      const user = results[0];
      // Compara a senha informada com a senha armazenada, utilizando bcrypt.
      const passwordMatch = await bcrypt.compare(password, user.senha);
      if (!passwordMatch) {
        return res.render("login", { message: "Usuário ou senha inválidos" });
      }
      // Se as credenciais estiverem corretas, armazena os dados do usuário na sessão.
      req.session.user = user;
      req.session.successMessage = "Logado com sucesso!";
      // Redireciona para o dashboard após o login bem-sucedido.
      res.redirect("/admin/dashboard");
    }
  );
});

// Rota GET para exibir o dashboard (rota protegida).
// Note que essa rota utiliza o middleware dummy "verificarAutenticacao" que não impede o acesso.
router.get("/admin/dashboard", verificarAutenticacao, (req, res) => {
  const db = req.db; // Conexão com o banco de dados.
  // Recupera a mensagem de sucesso armazenada na sessão e, em seguida, a remove.
  const successMessage = req.session.successMessage || "";
  delete req.session.successMessage;

  // Executa uma consulta SQL para buscar todos os cursos cadastrados no sistema.
  // Esses cursos serão utilizados para popular o filtro da dashboard.
  db.query("SELECT id, nome FROM curso", (err, cursos) => {
    if (err) {
      console.error("Erro ao buscar cursos:", err);
      // Se ocorrer um erro, renderiza a view com variáveis vazias.
      return res.render("dashboard", {
        username: req.session.user ? req.session.user.nome : "Usuário",
        message: "Erro ao carregar dados",
        cursos: [],
        turmas: [],
        cursoFiltro: null,
        turmaFiltro: null,
        performanceData: {},
      });
    }

    // Inicialmente, sem filtro de curso, definimos o array "turmas" como vazio.
    const turmas = [];

    // Dados fictícios para a performance do simulado.
    // Esses dados podem ser substituídos por consultas reais ao banco conforme a necessidade.
    const performanceData = {
      nota: 80, // Nota final do simulado
      correctCount: 40, // Número de acertos
      totalQuestions: 50, // Total de questões do simulado
      wrongAnswers: 5, // Número de erros
      blank: 5, // Número de questões em branco
      duracaoAluno: "45 minutos", // Duração que o aluno levou para concluir o simulado
      ucLabels: ["UC1", "UC2", "UC3"], // Labels para o gráfico de desempenho por Unidade Curricular (UC)
      acertosData: [15, 10, 15], // Dados de acertos para cada UC
      errosData: [2, 1, 2], // Dados de erros para cada UC
    };

    // Renderiza a view "dashboard.ejs" (localizada na pasta admin/views) e passa todas as variáveis necessárias.
    res.render("dashboard", {
      username: req.session.user ? req.session.user.nome : "Usuário",
      message: successMessage,
      cursos, // Array de cursos para o filtro.
      turmas, // Array de turmas (inicialmente vazio).
      cursoFiltro: null, // Valor inicial do filtro de curso.
      turmaFiltro: null, // Valor inicial do filtro de turma.
      performanceData, // Dados para popular os gráficos da dashboard.
    });
  });
});

// Rota para realizar o logout.
// Essa rota destrói a sessão e redireciona o usuário para a página de login.
router.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/admin/login");
});

// Exporta o objeto router para que ele seja utilizado na aplicação principal.
module.exports = router;
