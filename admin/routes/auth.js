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

        // Consulta os simulados e calcula a média das notas dos alunos que realizaram cada simulado
        let simuladosQuery = `
          SELECT s.id, s.titulo, AVG(ts.nota) AS media 
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
        simuladosQuery += " GROUP BY s.id, s.titulo";

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
  // incluindo o nome do aluno, nota, total de respostas e quantidade de acertos.
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
      });
    }
    // Calcula os erros para cada tentativa
    resultados.forEach((item) => {
      item.erros = item.total_respostas - item.acertos;
    });

    res.render("simuladoDetalhes", {
      message: "",
      detalhes: resultados,
      simuladoId: simuladoId,
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
