require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const path = require("path");

const app = express();

// Configuração do banco de dados MySQL
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
});

db.connect((error) => {
  if (error) {
    console.error("Erro ao conectar ao banco de dados:", error);
  } else {
    console.log("Conectado ao MySQL com sucesso");
  }
});

// Configuração dos middlewares
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);

// Middleware de autenticação
const verificarAutenticacao = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  next();
};

// ==========================
// Rotas de Autenticação
// ==========================

// Processa o login
app.post("/login", (req, res) => {
  const { email, password } = req.body;
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
      res.redirect("/dashboard");
    }
  );
});

// Exibe a página de login
app.get("/login", (req, res) => {
  const message = req.session.message || "";
  req.session.message = "";
  res.render("login", { message });
});

// Exibe o dashboard (rota protegida)
app.get("/dashboard", verificarAutenticacao, (req, res) => {
  const successMessage = req.session.successMessage || "";
  delete req.session.successMessage;
  res.render("dashboard", {
    username: req.session.user.nome,
    message: successMessage,
  });
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/login");
});

// ==========================
// Rotas de Registro (Professor)
// ==========================

// Exibe a página de registro
app.get("/registro", (req, res) => {
  // Aqui busca todos os cursos, pois o usuário ainda não está logado
  db.query("SELECT id, nome FROM curso", (err, results) => {
    if (err) {
      console.error("Erro ao buscar cursos:", err);
      return res.render("registro", {
        message: "Erro ao carregar cursos",
        cursos: [],
      });
    }
    res.render("registro", { message: "", cursos: results });
  });
});

// Processa o registro de professor
app.post("/registro", async (req, res) => {
  const { nome, matricula, curso, email, password } = req.body;
  db.query(
    "SELECT * FROM matricula_validada WHERE matricula = ?",
    [matricula],
    async (error, results) => {
      if (error) {
        console.error("Erro ao verificar matrícula:", error);
        return res.render("registro", {
          message: "Erro no sistema. Tente novamente!",
        });
      }
      if (results.length === 0) {
        return res.render("registro", {
          message: "Matrícula inválida ou não cadastrada.",
        });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      db.query(
        "INSERT INTO professor (nome, matricula, curso_id, email, senha) VALUES (?, ?, ?, ?, ?)",
        [nome, matricula, curso, email, hashedPassword],
        (error, result) => {
          if (error) {
            console.error("Erro ao cadastrar professor:", error);
            return res.render("registro", {
              message: "Erro ao criar professor.",
            });
          }
          const professorId = result.insertId;
          // Insere o relacionamento na tabela professor_curso
          db.query(
            "INSERT INTO professor_curso (professor_id, curso_id) VALUES (?, ?)",
            [professorId, curso],
            (err) => {
              if (err) {
                console.error("Erro ao vincular professor ao curso:", err);
                return res.render("registro", {
                  message: "Erro ao vincular professor ao curso.",
                });
              }
              return res.render("registro", {
                message: "Cadastro realizado com sucesso!",
                cursos: [],
              });
            }
          );
        }
      );
    }
  );
});

// ==========================
// Rotas de Turmas
// ==========================

// Listagem de turma com paginação

app.get("/turmas", verificarAutenticacao, (req, res) => {
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

app.post("/cadastrar-turma", verificarAutenticacao, (req, res) => {
  const { nome_turma, curso_id } = req.body;
  if (!nome_turma || !curso_id) {
    return res.status(400).json({ error: "Todos os campos são obrigatórios!" });
  }

  // Verifica se já existe uma turma para o curso para o professor logado
  db.query(
    "SELECT * FROM turma WHERE curso_id = ? AND professor_id = ?",
    [curso_id, req.session.user.id],
    (err, results) => {
      if (err) {
        console.error("Erro ao verificar turma:", err);
        return res.status(500).json({ error: "Erro ao verificar turma." });
      }
      if (results.length > 0) {
        return res
          .status(400)
          .json({ error: "Já existe uma turma cadastrada para este curso." });
      }
      // Insere a nova turma
      db.query(
        "INSERT INTO turma (nome, curso_id, professor_id) VALUES (?, ?, ?)",
        [nome_turma, curso_id, req.session.user.id],
        (err, result) => {
          if (err) {
            console.error("Erro ao cadastrar turma:", err);
            return res.status(500).json({ error: "Erro ao cadastrar turma." });
          }
          // Retorna a lista atualizada para a página 1
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

app.get("/deletar-turma/:id", verificarAutenticacao, (req, res) => {
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

app.post("/editar-turma", verificarAutenticacao, (req, res) => {
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

// ==========================
// Fim da Rotas de Turmas
// ==========================

// ==========================
// Rotas de Matéria
// ==========================

// Listagem de matérias com paginação (rota protegida)
app.get("/materias", verificarAutenticacao, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const offset = (page - 1) * limit;

  // Conta apenas as matérias do professor logado
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
      // Busca as matérias do professor logado com join no curso
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
          // Para o modal, busca somente os cursos vinculados ao professor logado
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
app.post("/cadastrar-materia", verificarAutenticacao, (req, res) => {
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
          // Retorna a lista atualizada filtrada pelo professor logado, para a página 1
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
app.get("/deletar-materia/:id", verificarAutenticacao, (req, res) => {
  const materiaId = req.params.id;
  // Verifica se a matéria pertence ao professor logado antes de excluir
  db.query(
    "DELETE FROM materia WHERE id = ? AND professor_id = ?",
    [materiaId, req.session.user.id],
    (err, result) => {
      if (err) {
        console.error("Erro ao excluir matéria:", err);
        return res.status(500).json({ error: "Erro ao excluir matéria." });
      }
      // Se nenhuma linha foi afetada, a matéria não pertence ao professor
      if (result.affectedRows === 0) {
        return res.status(403).json({ error: "Acesso negado." });
      }
      return res.json({ message: "Matéria excluída com sucesso!" });
    }
  );
});

// Edição de matéria – exibe o formulário de edição (rota protegida)
app.get("/editar-materia/:id", verificarAutenticacao, (req, res) => {
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
      // Busca somente os cursos vinculados ao professor logado
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
app.post("/editar-materia", verificarAutenticacao, (req, res) => {
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

// ==========================
// Fim da Rotas de Matéria
// ==========================

// ==========================
// Rotas de aluno
// ==========================

// Rota para listar turmas para cadastro de alunos
app.get("/aluno", verificarAutenticacao, (req, res) => {
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
          totalRows: 0, // Garante que a variável é enviada
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
app.get("/aluno/cadastrar", verificarAutenticacao, (req, res) => {
  const turmaId = req.query.turma_id;
  const page = parseInt(req.query.page) || 1; // Obtém o número da página ou usa 1 por padrão
  const limit = 10; // Defina o limite de alunos por página
  const offset = (page - 1) * limit;

  if (!turmaId) {
    return res.redirect("/aluno");
  }

  // Verifica se a turma pertence ao professor logado
  db.query(
    "SELECT * FROM turma WHERE id = ? AND professor_id = ?",
    [turmaId, req.session.user.id],
    (err, results) => {
      if (err || results.length === 0) {
        console.error("Erro ao verificar a turma:", err);
        return res.redirect("/aluno");
      }

      const turma = results[0];

      // Busca todas as turmas do professor logado
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

          // Busca os alunos da turma, paginando os resultados
          db.query(
            "SELECT id, nome, usuario FROM aluno WHERE turma_id = ? LIMIT ? OFFSET ?",
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

              // Contagem total de alunos para paginação
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
app.post("/aluno/cadastrar", verificarAutenticacao, (req, res) => {
  const { nome, usuario, senha, turma_id } = req.body;
  if (!nome || !usuario || !senha || !turma_id) {
    return res.render("alunoCadastrar", {
      turma: { id: turma_id },
      message: "Todos os campos são obrigatórios.",
    });
  }
  // Insere o aluno (observe que a senha não está criptografada; você pode adicionar criptografia se desejar)
  db.query(
    "INSERT INTO aluno (nome, usuario, senha, turma_id) VALUES (?, ?, ?, ?)",
    [nome, usuario, senha, turma_id],
    (err, result) => {
      if (err) {
        console.error("Erro ao cadastrar aluno:", err);
        return res.render("alunoCadastrar", {
          turma: { id: turma_id },
          message: "Erro ao cadastrar aluno.",
        });
      }
      // Após o cadastro, redireciona para uma página de listagem de alunos daquela turma
      res.redirect("/aluno/listar?turma_id=" + turma_id);
    }
  );
});

// Rota para listar os alunos de uma turma
app.get("/aluno/listar", verificarAutenticacao, (req, res) => {
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
      db.query(
        "SELECT * FROM aluno WHERE turma_id = ?",
        [turmaId],
        (err, alunos) => {
          if (err) {
            console.error("Erro ao buscar alunos:", err);
            return res.render("alunoListar", {
              turma,
              alunos: [],
              message: "Erro ao buscar alunos.",
            });
          }
          res.render("alunoListar", { turma, alunos, message: "" });
        }
      );
    }
  );
});

// ==========================
// Rotas de Questões
// ==========================

app.post("/cadastrar-questao", verificarAutenticacao, (req, res) => {
  const professorId = req.session.user.id;
  const {
    enunciado,
    alternativaA,
    alternativaB,
    alternativaC,
    alternativaD,
    correta,
    curso,
    titulo,
    dificuldade,
  } = req.body;

  // Verifica se o professor está vinculado ao curso usando a tabela professor_curso
  const verificaCursoQuery = `
    SELECT c.id 
    FROM curso c
    JOIN professor_curso pc ON pc.curso_id = c.id
    WHERE pc.professor_id = ? AND c.id = ?;
  `;
  db.query(verificaCursoQuery, [professorId, curso], (err, results) => {
    if (err) {
      console.error("Erro ao verificar curso:", err);
      return res.render("questoes", {
        message: "Erro ao verificar o curso.",
        cursos: [],
      });
    }
    if (results.length === 0) {
      return res.render("questoes", {
        message: "Você não tem permissão para cadastrar questões nesse curso.",
        cursos: [],
      });
    }
    // Query de inserção para 10 colunas:
    const cadastrarQuestaoQuery = `
      INSERT INTO questao (enunciado, alternativa_a, alternativa_b, alternativa_c, alternativa_d, resposta_correta, curso, titulo, dificuldade, professor_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;
    db.query(
      cadastrarQuestaoQuery,
      [
        enunciado,
        alternativaA,
        alternativaB,
        alternativaC,
        alternativaD,
        correta,
        curso,
        titulo,
        dificuldade,
        professorId,
      ],
      (err) => {
        if (err) {
          console.error("Erro ao cadastrar questão:", err);
          return res.render("questoes", {
            message: "Erro ao cadastrar a questão.",
            cursos: [],
          });
        }
        return res.render("questoes", {
          message: "Questão cadastrada com sucesso!",
          cursos: [],
        });
      }
    );
  });
});

// Inicializa o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
