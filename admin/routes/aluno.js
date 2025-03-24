const express = require("express");
const router = express.Router();
const multer = require("multer");
const csvParser = require("csv-parser"); // Para arquivos CSV
const fs = require("fs");

// Middleware de autenticação (pode ser reutilizado ou importado de outro módulo)
const verificarAutenticacao = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/admin/login");
  }
  next();
};

// Rota para listar turmas para cadastro de alunos
router.get("/admin/aluno", verificarAutenticacao, (req, res) => {
  const db = req.db;
  // Contar quantas turmas existem para o professor logado
  db.query(
    "SELECT COUNT(*) AS count FROM turma WHERE professor_id = ?",
    [req.session.user.id],
    (err, countResult) => {
      if (err) {
        console.error("Erro ao contar turmas:", err);
        return res.render("aluno", {
          message: "Erro ao buscar turmas",
          turmas: [],
          totalRows: 0,
          activeMenu: "aluno",
        });
      }

      const totalRows = countResult[0].count; // Obtém a contagem correta das turmas

      // Buscar as turmas do professor logado
      db.query(
        "SELECT t.id, t.nome, t.data_criacao, c.nome AS curso FROM turma t INNER JOIN curso c ON t.curso_id = c.id WHERE t.professor_id = ?",
        [req.session.user.id],
        (err, turmas) => {
          if (err) {
            console.error("Erro ao buscar turmas:", err);
            return res.render("aluno", {
              message: "Erro ao buscar turmas",
              turmas: [],
              totalRows: 0,
            });
          }

          if (turmas.length === 0) {
            return res.render("aluno", {
              message: "Nenhuma turma cadastrada.",
              turmas: [],
              totalRows,
            });
          }

          res.render("aluno", { message: "", turmas, totalRows });
        }
      );
    }
  );
});

// Rota para exibir o formulário de cadastro de aluno para uma turma específica
router.get("/admin/aluno/cadastrar", verificarAutenticacao, (req, res) => {
  const db = req.db;
  const turmaId = req.query.turma_id;
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const offset = (page - 1) * limit;

  if (!turmaId) {
    return res.redirect("/admin/aluno");
  }

  db.query(
    "SELECT * FROM turma WHERE id = ? AND professor_id = ?",
    [turmaId, req.session.user.id],
    (err, results) => {
      if (err || results.length === 0) {
        console.error("Erro ao verificar a turma:", err);
        return res.redirect("/admin/aluno");
      }
      const turma = results[0];

      db.query(
        "SELECT id, nome FROM turma WHERE professor_id = ?",
        [req.session.user.id],
        (err, turmas) => {
          if (err) {
            console.error("Erro ao buscar turmas:", err);
            return res.render("alunoCadastrar", {
              turma,
              turmas: [],
              alunos: [],
              totalRows: 0,
              currentPage: page,
              totalPages: 0,
              message: "Erro ao buscar turmas",
            });
          }

          db.query(
            "SELECT id, nome, usuario, senha, DATE_FORMAT(data_cadastro, '%d/%m/%Y %H:%i:%s') AS data_cadastro FROM aluno WHERE turma_id = ? LIMIT ? OFFSET ?",
            [turmaId, limit, offset],
            (err, alunos) => {
              if (err) {
                console.error("Erro ao buscar alunos:", err);
                return res.render("alunoCadastrar", {
                  turma,
                  turmas,
                  alunos: [],
                  totalRows: 0,
                  currentPage: page,
                  totalPages: 0,
                  message: "Erro ao buscar alunos",
                });
              }

              db.query(
                "SELECT COUNT(*) AS total FROM aluno WHERE turma_id = ?",
                [turmaId],
                (err, countResult) => {
                  if (err) {
                    console.error("Erro ao contar alunos:", err);
                    return res.render("alunoCadastrar", {
                      turma,
                      turmas,
                      alunos: [],
                      totalRows: 0,
                      currentPage: page,
                      totalPages: 0,
                      message: "Erro ao contar alunos",
                    });
                  }
                  const totalRows = countResult[0].total;
                  const totalPages = Math.ceil(totalRows / limit);
                  res.render("alunoCadastrar", {
                    turma,
                    turmas,
                    alunos,
                    totalRows,
                    currentPage: page,
                    totalPages,
                    message: "",
                  });
                }
              );
            }
          );
        }
      );
    }
  );
});

// Rota para processar o cadastro de aluno
router.post("/aluno/cadastrar", verificarAutenticacao, (req, res) => {
  const db = req.db;
  const { nome, usuario, senha, turma_id } = req.body;

  // Verifica se todos os campos obrigatórios foram informados
  if (!nome || !usuario || !senha || !turma_id) {
    return res.status(400).json({ error: "Todos os campos são obrigatórios." });
  }

  // Insere o aluno na tabela
  db.query(
    "INSERT INTO aluno (nome, usuario, senha, turma_id) VALUES (?, ?, ?, ?)",
    [nome, usuario, senha, turma_id],
    (err, result) => {
      if (err) {
        console.error("Erro ao cadastrar aluno:", err);
        return res.status(500).json({ error: "Erro ao cadastrar aluno." });
      }
      // Retorna uma resposta JSON de sucesso
      return res.json({ message: "Aluno cadastrado com sucesso!" });
    }
  );
});

// Rota para listar os alunos de uma turma
router.get("/admin/aluno/listar", verificarAutenticacao, (req, res) => {
  const db = req.db;
  const turmaId = req.query.turma_id;
  if (!turmaId) {
    return res.redirect("/aluno");
  }
  // Verifica se a turma pertence ao professor logado
  db.query(
    "SELECT * FROM turma WHERE id = ? AND professor_id = ?",
    [turmaId, req.session.user.id],
    (err, results) => {
      if (err || results.length === 0) {
        return res.redirect("/aluno");
      }
      const turma = results[0];
      const page = parseInt(req.query.page) || 1;
      const limit = 10;
      const offset = (page - 1) * limit;
      // Busca os alunos da turma com paginação
      db.query(
        "SELECT id, nome, usuario, senha, DATE_FORMAT(data_cadastro, '%d/%m/%Y %H:%i:%s') AS data_cadastro FROM aluno WHERE turma_id = ? LIMIT ? OFFSET ?",
        [turmaId, limit, offset],
        (err, alunos) => {
          if (err) {
            console.error("Erro ao buscar alunos:", err);
            return res.render("alunoListar", {
              turma,
              alunos: [],
              message: "Erro ao buscar alunos.",
            });
          }
          // Conta o total de alunos para paginação
          db.query(
            "SELECT COUNT(*) AS total FROM aluno WHERE turma_id = ?",
            [turmaId],
            (err, countResult) => {
              if (err) {
                console.error("Erro ao contar alunos:", err);
                return res.render("alunoListar", {
                  turma,
                  alunos: [],
                  message: "Erro ao contar alunos.",
                });
              }
              const totalRows = countResult[0].total;
              res.render("alunoListar", {
                turma,
                alunos,
                totalRows,
                currentPage: page,
                totalPages: Math.ceil(totalRows / limit),
                message: "",
              });
            }
          );
        }
      );
    }
  );
});

// Rota para editar aluno
router.post("/admin/editar-aluno", verificarAutenticacao, (req, res) => {
  const db = req.db;
  const { id, turma_id, nome, usuario, senha } = req.body;

  // Verifica se todos os campos obrigatórios foram informados
  if (!id || !turma_id || !nome || !usuario || !senha) {
    return res.status(400).json({ error: "Todos os campos são obrigatórios." });
  }

  // Atualiza o aluno somente se a turma à qual ele pertence for do professor autenticado
  db.query(
    `UPDATE aluno 
     INNER JOIN turma ON aluno.turma_id = turma.id 
     SET aluno.nome = ?, aluno.usuario = ?, aluno.senha = ?
     WHERE aluno.id = ? AND aluno.turma_id = ? AND turma.professor_id = ?`,
    [nome, usuario, senha, id, turma_id, req.session.user.id],
    (err, result) => {
      if (err) {
        console.error("Erro ao editar aluno:", err);
        return res.status(500).json({ error: "Erro ao editar aluno." });
      }
      if (result.affectedRows === 0) {
        return res
          .status(403)
          .json({ error: "Acesso negado ou aluno inexistente." });
      }
      return res.json({ message: "Aluno editado com sucesso!" });
    }
  );
});

// Rota para deletar aluno
router.get("/admin/deletar-aluno/:id", verificarAutenticacao, (req, res) => {
  const db = req.db;
  const alunoId = req.params.id;

  // Deleta o aluno somente se ele pertencer a uma turma cujo professor é o usuário autenticado
  db.query(
    `DELETE aluno
     FROM aluno
     INNER JOIN turma ON aluno.turma_id = turma.id
     WHERE aluno.id = ? AND turma.professor_id = ?`,
    [alunoId, req.session.user.id],
    (err, result) => {
      if (err) {
        console.error("Erro ao excluir aluno:", err);
        return res.status(500).json({ error: "Erro ao excluir aluno." });
      }
      if (result.affectedRows === 0) {
        return res
          .status(403)
          .json({ error: "Acesso negado ou aluno inexistente." });
      }
      return res.json({ message: "Aluno excluído com sucesso!" });
    }
  );
});
// Configura o multer para armazenar arquivos temporariamente
const upload = multer({ dest: "uploads/" });

// Rota para exibir a página de importação
router.get("/admin/aluno/importar", (req, res) => {
  res.render("importar", { message: null });
});

// Rota para processar o upload do arquivo CSV
router.post("/admin/aluno/importar", upload.single("arquivo"), (req, res) => {
  const file = req.file;
  if (!file) {
    return res.render("importar", {
      message: "Nenhum arquivo selecionado.",
    });
  }

  const alunos = [];
  fs.createReadStream(file.path)
    .pipe(csvParser())
    .on("data", (row) => {
      alunos.push(row);
    })
    .on("end", () => {
      const db = req.db;
      let insertPromises = alunos.map((aluno) => {
        return new Promise((resolve, reject) => {
          db.query(
            "INSERT INTO aluno (nome, usuario, senha, turma_id, data_cadastro) VALUES (?, ?, ?,?, ?)",
            [
              aluno.nome,
              aluno.usuario,
              aluno.senha,
              req.query.turma_id,
              aluno.data_cadastro || new Date(),
            ],
            (err, results) => {
              if (err) return reject(err);
              resolve(results);
            }
          );
        });
      });

      Promise.all(insertPromises)
        .then(() => {
          // Remove o arquivo temporário após processamento
          fs.unlinkSync(file.path);
          res.render("importar", {
            message: "Alunos importados com sucesso!",
          });
        })
        .catch((err) => {
          console.error("Erro ao inserir alunos:", err);
          res.render("importar", { message: "Erro ao importar alunos." });
        });
    });
});

module.exports = router;
