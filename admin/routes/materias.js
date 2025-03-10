const express = require("express");
const router = express.Router();

// Middleware de autenticação (pode ser reutilizado ou importado de outro módulo)
const verificarAutenticacao = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  next();
};

// Listagem de matérias com paginação (rota protegida)
router.get("/admin/materias", verificarAutenticacao, (req, res) => {
  const db = req.db;
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const offset = (page - 1) * limit;

  // Conta as matérias do professor logado
  db.query(
    "SELECT COUNT(*) AS count FROM materia WHERE professor_id = ?",
    [req.session.user.id],
    (err, countResult) => {
      if (err) {
        console.error("Erro ao contar matérias:", err);
        return res.render("materia", {
          message: "Erro ao buscar matérias",
          materias: [],
          currentPage: page,
          totalPages: 0,
          totalRows: 0,
          cursos: [],
        });
      }
      const totalRows = countResult[0].count;
      const totalPages = Math.ceil(totalRows / limit);

      // Busca as matérias com join no curso
      db.query(
        "SELECT m.id, m.nome, m.curso_id, c.nome AS curso FROM materia m INNER JOIN curso c ON m.curso_id = c.id WHERE m.professor_id = ? LIMIT ? OFFSET ?",
        [req.session.user.id, limit, offset],
        (err, materias) => {
          if (err) {
            console.error("Erro ao buscar matérias:", err);
            return res.render("materia", {
              message: "Erro ao buscar matérias",
              materias: [],
              currentPage: page,
              totalPages: 0,
              totalRows: 0,
              cursos: [],
            });
          }
          // Busca os cursos vinculados ao professor para o modal de cadastro
          db.query(
            "SELECT curso.id, curso.nome FROM curso INNER JOIN professor_curso ON curso.id = professor_curso.curso_id WHERE professor_curso.professor_id = ?",
            [req.session.user.id],
            (err, cursos) => {
              if (err) {
                console.error("Erro ao buscar cursos do professor:", err);
                cursos = [];
              }
              res.render("materia", {
                message: "",
                materias,
                currentPage: page,
                totalPages,
                totalRows,
                cursos,
              });
            }
          );
        }
      );
    }
  );
});

// Cadastro de nova matéria (rota protegida)
router.post("/cadastrar-materia", verificarAutenticacao, (req, res) => {
  const db = req.db;
  const { nome_materia, curso_id } = req.body;
  if (!nome_materia || !curso_id) {
    return res.status(400).json({ error: "Todos os campos são obrigatórios!" });
  }

  // Verifica se a matéria já existe para o mesmo curso e professor
  db.query(
    "SELECT * FROM materia WHERE nome = ? AND curso_id = ? AND professor_id = ?",
    [nome_materia, curso_id, req.session.user.id],
    (err, results) => {
      if (err) {
        console.error("Erro ao verificar matéria:", err);
        return res.status(500).json({ error: "Erro ao verificar matéria." });
      }
      if (results.length > 0) {
        return res
          .status(400)
          .json({ error: "Essa matéria já está cadastrada para este curso." });
      }

      // Insere a nova matéria associada ao professor logado
      db.query(
        "INSERT INTO materia (nome, curso_id, professor_id) VALUES (?, ?, ?)",
        [nome_materia, curso_id, req.session.user.id],
        (err, result) => {
          if (err) {
            console.error("Erro ao cadastrar matéria:", err);
            return res
              .status(500)
              .json({ error: "Erro ao cadastrar matéria." });
          }
          // Retorna a lista atualizada de matérias (página 1)
          db.query(
            "SELECT m.id, m.nome, m.curso_id, c.nome AS curso FROM materia m INNER JOIN curso c ON m.curso_id = c.id WHERE m.professor_id = ? LIMIT ? OFFSET ?",
            [req.session.user.id, 10, 0],
            (err, materias) => {
              if (err) {
                console.error("Erro ao buscar matérias:", err);
                return res
                  .status(500)
                  .json({ error: "Erro ao buscar matérias." });
              }
              return res.json({
                message: "Cadastro realizado com sucesso!",
                materias,
              });
            }
          );
        }
      );
    }
  );
});

// Exclusão de matéria (rota protegida)
router.get("/deletar-materia/:id", verificarAutenticacao, (req, res) => {
  const db = req.db;
  const materiaId = req.params.id;
  db.query(
    "DELETE FROM materia WHERE id = ? AND professor_id = ?",
    [materiaId, req.session.user.id],
    (err, result) => {
      if (err) {
        console.error("Erro ao excluir matéria:", err);
        return res.status(500).json({ error: "Erro ao excluir matéria." });
      }
      if (result.affectedRows === 0) {
        return res.status(403).json({ error: "Acesso negado." });
      }
      return res.json({ message: "Matéria excluída com sucesso!" });
    }
  );
});

// Edição de matéria – exibe o formulário de edição (rota protegida)
router.get("/editar-materia/:id", verificarAutenticacao, (req, res) => {
  const db = req.db;
  const materiaId = req.params.id;
  db.query(
    "SELECT * FROM materia WHERE id = ?",
    [materiaId],
    (err, results) => {
      if (err) {
        console.error("Erro ao buscar matéria:", err);
        return res.redirect("/materias");
      }
      if (results.length === 0) {
        return res.redirect("/materias");
      }
      const materia = results[0];
      // Busca os cursos vinculados ao professor
      db.query(
        "SELECT curso.id, curso.nome FROM curso INNER JOIN professor_curso ON curso.id = professor_curso.curso_id WHERE professor_curso.professor_id = ?",
        [req.session.user.id],
        (err, cursos) => {
          if (err) {
            console.error("Erro ao buscar cursos:", err);
            cursos = [];
          }
          res.render("editarMateria", { materia, cursos, message: "" });
        }
      );
    }
  );
});

// Atualização de matéria (rota protegida)
router.post("/editar-materia", verificarAutenticacao, (req, res) => {
  const db = req.db;
  const { id, nome_materia, curso_id } = req.body;
  db.query(
    "UPDATE materia SET nome = ?, curso_id = ? WHERE id = ? AND professor_id = ?",
    [nome_materia, curso_id, id, req.session.user.id],
    (err, result) => {
      if (err) {
        console.error("Erro ao atualizar matéria:", err);
        return res.status(500).json({ error: "Erro ao atualizar matéria." });
      }
      if (result.affectedRows === 0) {
        return res
          .status(403)
          .json({ error: "Acesso negado ou matéria não encontrada." });
      }
      return res.json({ message: "Matéria editada com sucesso!" });
    }
  );
});

module.exports = router;
