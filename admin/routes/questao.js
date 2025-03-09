const express = require("express");
const router = express.Router();

// Middleware de autenticação
const verificarAutenticacao = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  next();
};

// ==========================
// Rotas de Questões
// ==========================

// Listagem de questões com paginação e pesquisa
router.get("/questao", verificarAutenticacao, (req, res) => {
  const db = req.db;
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const offset = (page - 1) * limit;
  const searchTerm = req.query.search ? req.query.search.trim() : "";

  // Constrói a cláusula WHERE
  let baseWhere = "WHERE m.professor_id = ?";
  let queryParams = [req.session.user.id];

  if (searchTerm) {
    baseWhere +=
      " AND (q.titulo LIKE ? OR c.nome LIKE ? OR m.nome LIKE ? OR q.enunciado LIKE ?)";
    const wildcard = "%" + searchTerm + "%";
    queryParams.push(wildcard, wildcard, wildcard, wildcard);
  }

  // Query para contar registros
  const countQuery = `
    SELECT COUNT(*) AS count
    FROM questao q
    INNER JOIN materia m ON q.materia_id = m.id
    INNER JOIN curso c ON q.curso_id = c.id
    ${baseWhere}
  `;
  db.query(countQuery, queryParams, (err, countResult) => {
    if (err) {
      console.error("Erro ao contar questões:", err);
      return res.render("questao", {
        message: "Erro ao buscar questões",
        questoes: [],
        currentPage: page,
        totalPages: 0,
        totalRows: 0,
        cursos: [],
        materias: [],
        search: searchTerm,
      });
    }
    const totalRows = countResult[0].count;
    const totalPages = Math.ceil(totalRows / limit);

    // Query para buscar os dados das questões com LIMIT e OFFSET
    const dataQuery = `
      SELECT q.id, q.titulo,
             IF(LENGTH(q.enunciado) > 10, CONCAT(LEFT(q.enunciado, 25), '...'), q.enunciado) AS enunciado,
             q.alternativa_a, q.alternativa_b, q.alternativa_c, q.alternativa_d,
             q.resposta_correta, q.curso_id, q.materia_id,
             c.nome AS curso, m.nome AS materia
      FROM questao q
      INNER JOIN curso c ON q.curso_id = c.id
      INNER JOIN materia m ON q.materia_id = m.id
      ${baseWhere}
      LIMIT ? OFFSET ?
    `;
    let dataParams = queryParams.slice();
    dataParams.push(limit, offset);

    db.query(dataQuery, dataParams, (err, questoes) => {
      if (err) {
        console.error("Erro ao buscar questões:", err);
        return res.render("questao", {
          message: "Erro ao buscar questões",
          questoes: [],
          currentPage: page,
          totalPages: 0,
          totalRows: 0,
          cursos: [],
          materias: [],
          search: searchTerm,
        });
      }
      // Busca os cursos vinculados ao professor (para os selects dos formulários)
      db.query(
        "SELECT c.id, c.nome FROM curso c INNER JOIN professor_curso pc ON c.id = pc.curso_id WHERE pc.professor_id = ?",
        [req.session.user.id],
        (err, cursos) => {
          if (err) {
            console.error("Erro ao buscar cursos:", err);
            cursos = [];
          }
          // Busca as matérias do professor
          db.query(
            "SELECT m.id, m.nome FROM materia m WHERE m.professor_id = ?",
            [req.session.user.id],
            (err, materias) => {
              if (err) {
                console.error("Erro ao buscar matérias:", err);
                materias = [];
              }
              res.render("questao", {
                message: "",
                questoes,
                currentPage: page,
                totalPages,
                totalRows,
                cursos,
                materias,
                search: searchTerm,
              });
            }
          );
        }
      );
    });
  });
});

// Exibe o formulário de cadastro de questão
router.get("/cadastrar-questao", verificarAutenticacao, (req, res) => {
  const db = req.db;
  // Busca os cursos vinculados ao professor
  db.query(
    "SELECT c.id, c.nome FROM curso c INNER JOIN professor_curso pc ON c.id = pc.curso_id WHERE pc.professor_id = ?",
    [req.session.user.id],
    (err, cursos) => {
      if (err) {
        console.error("Erro ao buscar cursos:", err);
        cursos = [];
      }
      // Busca as matérias do professor
      db.query(
        "SELECT m.id, m.nome FROM materia m WHERE m.professor_id = ?",
        [req.session.user.id],
        (err, materias) => {
          if (err) {
            console.error("Erro ao buscar matérias:", err);
            materias = [];
          }
          res.render("questaoCadastrar", { cursos, materias, message: "" });
        }
      );
    }
  );
});

// Retorna as matérias de um determinado curso (usado para selects dinâmicos)
router.get(
  "/materias-por-curso/:curso_id",
  verificarAutenticacao,
  (req, res) => {
    const db = req.db;
    const cursoId = req.params.curso_id;
    const professorId = req.session.user.id;
    db.query(
      "SELECT id, nome FROM materia WHERE curso_id = ? AND professor_id = ?",
      [cursoId, professorId],
      (err, results) => {
        if (err) {
          console.error("Erro ao buscar matérias:", err);
          return res.status(500).json({ error: "Erro ao buscar matérias." });
        }
        return res.json(results);
      }
    );
  }
);

// Cadastro de nova questão
router.post("/cadastrar-questao", verificarAutenticacao, (req, res) => {
  const db = req.db;
  const {
    curso_id,
    materia_id,
    titulo,
    enunciado,
    alternativa_a,
    alternativa_b,
    alternativa_c,
    alternativa_d,
    resposta_correta,
  } = req.body;
  if (
    !curso_id ||
    !materia_id ||
    !titulo ||
    !enunciado ||
    !alternativa_a ||
    !alternativa_b ||
    !alternativa_c ||
    !alternativa_d ||
    !resposta_correta
  ) {
    return res.status(400).json({ error: "Todos os campos são obrigatórios." });
  }
  db.query(
    "INSERT INTO questao (curso_id, materia_id, titulo, enunciado, alternativa_a, alternativa_b, alternativa_c, alternativa_d, resposta_correta) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      curso_id,
      materia_id,
      titulo,
      enunciado,
      alternativa_a,
      alternativa_b,
      alternativa_c,
      alternativa_d,
      resposta_correta,
    ],
    (err, result) => {
      if (err) {
        console.error("Erro ao cadastrar questão:", err);
        return res.status(500).json({ error: "Erro ao cadastrar questão." });
      }
      return res.json({ message: "Questão cadastrada com sucesso!" });
    }
  );
});

// Atualização de questão (usando INNER JOIN para validar o professor)
router.post("/editar-questao", verificarAutenticacao, (req, res) => {
  const db = req.db;
  const {
    id,
    curso_id,
    materia_id,
    titulo,
    enunciado,
    alternativa_a,
    alternativa_b,
    alternativa_c,
    alternativa_d,
    resposta_correta,
  } = req.body;
  if (
    !id ||
    !curso_id ||
    !materia_id ||
    !titulo ||
    !enunciado ||
    !alternativa_a ||
    !alternativa_b ||
    !alternativa_c ||
    !alternativa_d ||
    !resposta_correta
  ) {
    return res.status(400).json({ erro: "Todos os campos são obrigatórios." });
  }
  db.query(
    `UPDATE questao 
     INNER JOIN materia ON questao.materia_id = materia.id 
     SET questao.curso_id = ?, questao.materia_id = ?, questao.titulo = ?, questao.enunciado = ?, 
         questao.alternativa_a = ?, questao.alternativa_b = ?, questao.alternativa_c = ?, 
         questao.alternativa_d = ?, questao.resposta_correta = ? 
     WHERE questao.id = ? AND materia.professor_id = ?`,
    [
      curso_id,
      materia_id,
      titulo,
      enunciado,
      alternativa_a,
      alternativa_b,
      alternativa_c,
      alternativa_d,
      resposta_correta,
      id,
      req.session.user.id,
    ],
    (erro, resultado) => {
      if (erro) {
        console.error("Erro ao atualizar a questão:", erro);
        return res.status(500).json({ erro: "Erro ao atualizar a questão." });
      }
      if (resultado.affectedRows === 0) {
        return res
          .status(403)
          .json({ erro: "Acesso negado ou questão inexistente." });
      }
      return res.json({ mensagem: "Questão editada com sucesso!" });
    }
  );
});

// Deletar uma questão
router.delete(
  "/deletar-questao/:identificador",
  verificarAutenticacao,
  (req, res) => {
    const db = req.db;
    const identificadorDaQuestao = req.params.identificador;
    db.query(
      "DELETE questao FROM questao INNER JOIN materia ON questao.materia_id = materia.id WHERE questao.id = ? AND materia.professor_id = ?",
      [identificadorDaQuestao, req.session.user.id],
      (erro, resultado) => {
        if (erro) {
          console.error("Erro ao excluir a questão:", erro);
          return res.status(500).json({ erro: "Erro ao excluir a questão." });
        }
        if (resultado.affectedRows === 0) {
          return res
            .status(403)
            .json({ erro: "Acesso negado ou questão inexistente." });
        }
        return res.json({ mensagem: "Questão excluída com sucesso!" });
      }
    );
  }
);

// Exibe o formulário de edição de questão
router.get(
  "/editar-questao/:identificador",
  verificarAutenticacao,
  (req, res) => {
    const db = req.db;
    const identificadorDaQuestao = req.params.identificador;
    const identificadorDoProfessor = req.session.user.id;

    db.query(
      `SELECT questao.*, curso.nome AS curso, materia.nome AS materia 
     FROM questao 
     INNER JOIN materia ON questao.materia_id = materia.id 
     INNER JOIN curso ON questao.curso_id = curso.id 
     WHERE questao.id = ? AND materia.professor_id = ?`,
      [identificadorDaQuestao, identificadorDoProfessor],
      (erro, resultados) => {
        if (erro) {
          console.error("Erro ao executar a consulta SQL:", erro);
          return res.status(500).send("Erro interno no servidor.");
        }
        if (resultados.length === 0) {
          return res.redirect("/questao?page=1");
        }
        const questao = resultados[0];
        // Buscar cursos vinculados ao professor
        db.query(
          "SELECT c.id, c.nome FROM curso c INNER JOIN professor_curso pc ON c.id = pc.curso_id WHERE pc.professor_id = ?",
          [identificadorDoProfessor],
          (erro, cursos) => {
            if (erro) {
              console.error("Erro ao buscar cursos:", erro);
              cursos = [];
            }
            // Buscar matérias do professor
            db.query(
              "SELECT id, nome FROM materia WHERE professor_id = ?",
              [identificadorDoProfessor],
              (erro, materias) => {
                if (erro) {
                  console.error("Erro ao buscar matérias:", erro);
                  materias = [];
                }
                res.render("editQuestao", {
                  questao,
                  cursos,
                  materias,
                  mensagem: "",
                });
              }
            );
          }
        );
      }
    );
  }
);

module.exports = router;
