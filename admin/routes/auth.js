// ===================================================================
// Importa o módulo Express e cria um objeto Router para definir as rotas da aplicação.
// ===================================================================
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");

// ===================================================================
// Middleware para verificação de autenticação real.
// Se não houver usuário na sessão, redireciona para o login.
// ===================================================================
const verificarAutenticacao = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/admin/login");
  }
  next();
};

// ===================================================================
// Rota GET para exibir a página de login.
// ===================================================================
router.get("/admin/login", (req, res) => {
  const message = req.session.message || "";
  req.session.message = "";
  res.render("login", { message });
});

// ===================================================================
// Rota POST para processar o login.
// ===================================================================
router.post("/admin/login", (req, res) => {
  const { email, password } = req.body;
  const db = req.db;

  db.query(
    "SELECT * FROM professor WHERE email = ?",
    [email],
    async (err, results) => {
      if (err) {
        console.error("Erro na consulta SQL:", err);
        return res.render("login", { message: "Erro no sistema" });
      }
      if (results.length === 0) {
        return res.render("login", { message: "Usuário ou senha inválidos" });
      }
      const user = results[0];
      const passwordMatch = await bcrypt.compare(password, user.senha);
      if (!passwordMatch) {
        return res.render("login", { message: "Usuário ou senha inválidos" });
      }
      req.session.user = user;
      req.session.successMessage = "Logado com sucesso!";
      res.redirect("/admin/dashboard");
    }
  );
});

// ===================================================================
// Rota GET para exibir o dashboard (rota protegida).
// ===================================================================
router.get("/admin/dashboard", verificarAutenticacao, (req, res) => {
  const db = req.db;
  const successMessage = req.session.successMessage || "";
  delete req.session.successMessage;

  // Recupera os filtros da query string
  const cursoFiltro = req.query.curso || null;
  const turmaFiltro = req.query.turma || null;

  // Busca os cursos vinculados ao professor logado
  db.query(
    "SELECT curso.id, curso.nome FROM curso INNER JOIN professor_curso ON curso.id = professor_curso.curso_id WHERE professor_curso.professor_id = ?",
    [req.session.user.id],
    (err, cursos) => {
      if (err) {
        console.error("Erro ao buscar cursos:", err);
        return res.render("dashboard", {
          user: req.session.user,
          message: "Erro ao carregar dados",
          cursos: [],
          turmas: [],
          cursoFiltro: null,
          turmaFiltro: null,
          performanceData: {},
        });
      }

      // Função para buscar turmas se houver filtro de curso
      const fetchTurmas = (callback) => {
        if (cursoFiltro) {
          db.query(
            "SELECT t.id, t.nome, t.curso_id, t.data_criacao FROM turma t WHERE t.professor_id = ? AND t.curso_id = ?",
            [req.session.user.id, cursoFiltro],
            (err, turmas) => {
              if (err) {
                return callback(err, []);
              }
              callback(null, turmas);
            }
          );
        } else {
          callback(null, []);
        }
      };

      fetchTurmas((err, turmas) => {
        if (err) {
          console.error("Erro ao buscar turmas:", err);
          turmas = [];
        }

        // Atualize a consulta para incluir a descrição do simulado (s.descricao)
        let simuladosQuery = `
          SELECT s.id, s.titulo, s.descricao, s.data_criacao, AVG(ts.nota) AS media, COUNT(ts.id) AS total_alunos
          FROM simulado s 
          LEFT JOIN tentativa_simulado ts ON s.id = ts.simulado_id 
          WHERE s.professor_id = ?
        `;
        let queryParams = [req.session.user.id];

        if (cursoFiltro) {
          simuladosQuery += " AND s.curso_id = ? ";
          queryParams.push(cursoFiltro);
        }
        if (turmaFiltro) {
          simuladosQuery += " AND s.turma_id = ? ";
          queryParams.push(turmaFiltro);
        }
        // Inclua s.descricao no GROUP BY para que esse campo seja retornado
        simuladosQuery +=
          " GROUP BY s.id, s.titulo, s.descricao, s.data_criacao";

        db.query(simuladosQuery, queryParams, (err, simulados) => {
          if (err) {
            console.error("Erro ao buscar simulados:", err);
            simulados = [];
          }

          const performanceData = {
            nota: 80,
            correctCount: 40,
            totalQuestions: 50,
            wrongAnswers: 5,
            blank: 5,
            duracaoAluno: "45 minutos",
            ucLabels: ["UC1", "UC2", "UC3"],
            acertosData: [15, 10, 15],
            errosData: [2, 1, 2],
            // Cada item agora inclui: id, titulo, descricao, data_criacao, media e total_alunos
            simuladosData: simulados,
          };

          res.render("dashboard", {
            user: req.session.user,
            message: successMessage,
            cursos: cursos,
            turmas: turmas,
            cursoFiltro: cursoFiltro,
            turmaFiltro: turmaFiltro,
            performanceData: performanceData,
          });
        });
      });
    }
  );
});

// ===================================================================
// Endpoint AJAX: Retorna as turmas vinculadas ao curso selecionado.
// ===================================================================
router.get(
  "/admin/turmas/by-curso/:cursoId",
  verificarAutenticacao,
  (req, res) => {
    const db = req.db;
    const cursoId = req.params.cursoId;
    db.query(
      "SELECT t.id, t.nome, t.curso_id, t.data_criacao FROM turma t WHERE t.professor_id = ? AND t.curso_id = ?",
      [req.session.user.id, cursoId],
      (err, turmas) => {
        if (err) {
          console.error("Erro ao buscar turmas:", err);
          return res.status(500).json({ error: "Erro ao buscar turmas." });
        }
        res.json({ turmas });
      }
    );
  }
);

// ===================================================================
// Rota GET para exibir os detalhes de um simulado.
// ===================================================================
router.get("/admin/simulados/:id", verificarAutenticacao, (req, res) => {
  const db = req.db;
  const simuladoId = req.params.id;

  // Consulta para obter os detalhes das tentativas do simulado,
  // incluindo nome do aluno, nota, total de respostas e quantidade de acertos.
  const query = `
    SELECT a.nome AS aluno, ts.nota, 
           COUNT(ra.id) AS total_respostas, 
           SUM(CASE WHEN ra.correta = 1 THEN 1 ELSE 0 END) AS acertos
    FROM tentativa_simulado ts
    LEFT JOIN aluno a ON ts.aluno_id = a.id
    LEFT JOIN resposta_aluno ra ON ts.id = ra.tentativa_id
    WHERE ts.simulado_id = ?
    GROUP BY ts.id, a.nome, ts.nota
  `;

  db.query(query, [simuladoId], (err, resultados) => {
    if (err) {
      console.error("Erro ao buscar detalhes do simulado:", err);
      return res.render("simuladoDetalhes", {
        message: "Erro ao carregar detalhes do simulado",
        detalhes: [],
        simuladoId: simuladoId,
        totalStudents: 0,
        above70: 0,
        below70: 0,
        averageGrade: 0,
      });
    }

    // Para cada registro, calcula os erros subtraindo os acertos do total de respostas.
    resultados.forEach((item) => {
      item.erros = item.total_respostas - item.acertos;
    });

    // Cálculo dos valores para os cards:
    // Total de alunos que fizeram a prova (tamanho do array de resultados)
    const totalStudents = resultados.length;

    // Cálculo do total das notas:
    // Converte o valor de cada nota para número com parseFloat.
    // Se a conversão resultar em NaN, considera 0 para evitar erros na soma.
    const totalGrades = resultados.reduce((acc, curr) => {
      const nota = parseFloat(curr.nota);
      return acc + (isNaN(nota) ? 0 : nota);
    }, 0);

    // Cálculo da média aritmética:
    // Caso haja alunos, divide o total das notas pelo número total de alunos
    // e formata o resultado para 2 casas decimais.
    const averageGrade =
      totalStudents > 0 ? (totalGrades / totalStudents).toFixed(2) : 0;

    // Cálculo da quantidade de alunos com nota superior a 70.00:
    // Converte cada nota para número e utiliza o método filter para contar.
    const above70 = resultados.filter((item) => {
      const nota = parseFloat(item.nota);
      return !isNaN(nota) && nota > 70;
    }).length;

    // Cálculo da quantidade de alunos com nota inferior a 70.00:
    const below70 = resultados.filter((item) => {
      const nota = parseFloat(item.nota);
      return !isNaN(nota) && nota < 70;
    }).length;

    // Renderiza o template passando todos os dados necessários.
    res.render("simuladoDetalhes", {
      message: "",
      detalhes: resultados,
      simuladoId: simuladoId,
      totalStudents: totalStudents,
      above70: above70,
      below70: below70,
      averageGrade: averageGrade,
    });
  });
});

// ===================================================================
// Rota para Realizar o Logout.
// ===================================================================
router.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/admin/login");
});

// ===================================================================
// Exportação do Objeto Router.
// ===================================================================
module.exports = router;
