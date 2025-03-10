const express = require("express");
const router = express.Router();

// Middleware de autenticação (pode ser reutilizado ou importado de um módulo separado)
const verificarAutenticacao = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  next();
};

// Listagem de turmas com paginação
router.get("/admin/turmas", verificarAutenticacao, (req, res) => {
  const db = req.db; // ou importe o db de outro módulo, conforme sua configuração
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const offset = (page - 1) * limit;

  // Conta as turmas do professor logado
  db.query(
    "SELECT COUNT(*) AS count FROM turma WHERE professor_id = ?",
    [req.session.user.id],
    (err, countResult) => {
      if (err) {
        console.error("Erro ao contar turmas:", err);
        return res.render("turma", {
          message: "Erro ao buscar turmas",
          turmas: [],
          currentPage: page,
          totalPages: 0,
          totalRows: 0,
          cursos: [],
        });
      }
      const totalRows = countResult[0].count;
      const totalPages = Math.ceil(totalRows / limit);

      // Busca as turmas com join para obter o nome do curso e data de criação
      db.query(
        "SELECT t.id, t.nome, t.curso_id, t.data_criacao, c.nome AS curso FROM turma t INNER JOIN curso c ON t.curso_id = c.id WHERE t.professor_id = ? LIMIT ? OFFSET ?",
        [req.session.user.id, limit, offset],
        (err, turmas) => {
          if (err) {
            console.error("Erro ao buscar turmas:", err);
            return res.render("turma", {
              message: "Erro ao buscar turmas",
              turmas: [],
              currentPage: page,
              totalPages: 0,
              totalRows: 0,
              cursos: [],
            });
          }
          // Para o modal de cadastro, busque os cursos vinculados ao professor
          db.query(
            "SELECT curso.id, curso.nome FROM curso INNER JOIN professor_curso ON curso.id = professor_curso.curso_id WHERE professor_curso.professor_id = ?",
            [req.session.user.id],
            (err, cursos) => {
              if (err) {
                console.error("Erro ao buscar cursos do professor:", err);
                cursos = [];
              }
              res.render("turma", {
                message: "",
                turmas,
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

// Cadastro de nova turma
router.post("/cadastrar-turma", verificarAutenticacao, (req, res) => {
  const db = req.db;
  const { nome_turma, curso_id } = req.body;

  if (!nome_turma || !curso_id) {
    return res.status(400).json({ error: "Todos os campos são obrigatórios!" });
  }

  // Verifica se já existe uma turma com o mesmo nome para o mesmo curso e professor
  db.query(
    "SELECT * FROM turma WHERE curso_id = ? AND professor_id = ? AND nome = ?",
    [curso_id, req.session.user.id, nome_turma],
    (err, results) => {
      if (err) {
        console.error("Erro ao verificar turma:", err);
        return res.status(500).json({ error: "Erro ao verificar turma." });
      }

      if (results.length > 0) {
        return res.status(400).json({
          error: "Já existe uma turma com essa descrição neste curso.",
        });
      }

      // Insere a nova turma, se não houver duplicata
      db.query(
        "INSERT INTO turma (nome, curso_id, professor_id) VALUES (?, ?, ?)",
        [nome_turma, curso_id, req.session.user.id],
        (err, result) => {
          if (err) {
            console.error("Erro ao cadastrar turma:", err);
            return res.status(500).json({ error: "Erro ao cadastrar turma." });
          }

          // Retorna a lista atualizada de turmas para o professor
          db.query(
            "SELECT t.id, t.nome, t.curso_id, t.data_criacao, c.nome AS curso FROM turma t INNER JOIN curso c ON t.curso_id = c.id WHERE t.professor_id = ? LIMIT ? OFFSET ?",
            [req.session.user.id, 10, 0],
            (err, turmas) => {
              if (err) {
                console.error("Erro ao buscar turmas:", err);
                return res
                  .status(500)
                  .json({ error: "Erro ao buscar turmas." });
              }
              return res.json({
                message: "Turma cadastrada com sucesso!",
                turmas,
              });
            }
          );
        }
      );
    }
  );
});

// Exclusão de turma
router.get("/deletar-turma/:id", verificarAutenticacao, (req, res) => {
  const db = req.db;
  const turmaId = req.params.id;
  db.query(
    "DELETE FROM turma WHERE id = ? AND professor_id = ?",
    [turmaId, req.session.user.id],
    (err, result) => {
      if (err) {
        console.error("Erro ao excluir turma:", err);
        return res.status(500).json({ error: "Erro ao excluir turma." });
      }
      if (result.affectedRows === 0) {
        return res.status(403).json({ error: "Acesso negado." });
      }
      return res.json({ message: "Turma excluída com sucesso!" });
    }
  );
});

// Edição de turma
router.post("/editar-turma", verificarAutenticacao, (req, res) => {
  const db = req.db;
  const { id, nome_turma, curso_id } = req.body;
  db.query(
    "UPDATE turma SET nome = ?, curso_id = ? WHERE id = ? AND professor_id = ?",
    [nome_turma, curso_id, id, req.session.user.id],
    (err, result) => {
      if (err) {
        console.error("Erro ao atualizar turma:", err);
        return res.status(500).json({ error: "Erro ao atualizar turma." });
      }
      if (result.affectedRows === 0) {
        return res
          .status(403)
          .json({ error: "Acesso negado ou turma inexistente." });
      }
      return res.json({ message: "Turma editada com sucesso!" });
    }
  );
});

module.exports = router;
