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
  // Busca todos os cursos disponíveis
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

app.post("/registro", async (req, res) => {
  const { nome, matricula, curso, email, password } = req.body;

  try {
    // Verifica se a matrícula é válida
    const [results] = await db
      .promise()
      .query("SELECT * FROM matricula_validada WHERE matricula = ?", [
        matricula,
      ]);

    if (results.length === 0) {
      return res.redirect(
        "/registro?error=Matrícula inválida ou não cadastrada."
      );
    }

    // Verifica se algum curso foi selecionado
    let cursosSelecionados = Array.isArray(curso) ? curso : [curso];

    if (!cursosSelecionados.length || cursosSelecionados[0] === "") {
      return res.redirect("/registro?error=Selecione pelo menos um curso.");
    }

    // Hash da senha antes de inserir no banco
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insere o professor sem curso_id
    const [professorResult] = await db
      .promise()
      .query(
        "INSERT INTO professor (nome, matricula, email, senha) VALUES (?, ?, ?, ?)",
        [nome, matricula, email, hashedPassword]
      );

    const professorId = professorResult.insertId;

    // Cria os placeholders para inserção múltipla
    let placeholders = cursosSelecionados.map(() => "(?, ?)").join(", ");
    let values = cursosSelecionados.flatMap((c) => [professorId, c]);

    // Insere os cursos na tabela professor_curso
    await db
      .promise()
      .query(
        `INSERT INTO professor_curso (professor_id, curso_id) VALUES ${placeholders}`,
        values
      );

    return res.redirect("/registro?success=true");
  } catch (error) {
    console.error("Erro no registro:", error);

    let errorMessage = "Erro ao cadastrar professor.";
    if (error.code === "ER_DUP_ENTRY") {
      errorMessage = "E-mail ou matrícula já cadastrados.";
    }

    return res.redirect(`/registro?error=${encodeURIComponent(errorMessage)}`);
  }
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
            "SELECT id, nome, usuario, senha, DATE_FORMAT(data_cadastro, '%D/%M/%Y %H:%i:%s') AS data_cadastro FROM aluno WHERE turma_id = ? LIMIT ? OFFSET ?",
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
    "SELECT * FROM aluno WHERE id = ? AND professor_id = ?",
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

app.get("/questoes", verificarAutenticacao, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const offset = (page - 1) * limit;
  const searchTerm = req.query.search ? req.query.search.trim() : "";

  // Começa a construir a cláusula WHERE
  let baseWhere = "WHERE m.professor_id = ?";
  let queryParams = [req.session.user.id];

  // Se houver termo de pesquisa, adiciona condições para os campos
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

    // Query para buscar os dados das questões, com LIMIT e OFFSET
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
    // Clone os parâmetros da query e acrescente os de paginação
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
      // Busca os cursos vinculados ao professor (para os selects dos formulários, por exemplo)
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

app.get("/cadastrar-questao", verificarAutenticacao, (req, res) => {
  // Supondo que você precise passar os cursos e matérias do professor para os selects:
  db.query(
    "SELECT c.id, c.nome FROM curso c INNER JOIN professor_curso pc ON c.id = pc.curso_id WHERE pc.professor_id = ?",
    [req.session.user.id],
    (err, cursos) => {
      if (err) {
        console.error("Erro ao buscar cursos:", err);
        cursos = [];
      }
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

app.get("/materias-por-curso/:curso_id", verificarAutenticacao, (req, res) => {
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
});

app.post("/cadastrar-questao", verificarAutenticacao, (req, res) => {
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

// Rota para deletar uma questão
app.delete(
  "/deletar-questao/:identificador",
  verificarAutenticacao,
  (requisicao, resposta) => {
    const identificadorDaQuestao = requisicao.params.identificador;
    // Garantir que a questão pertence ao professor, verificando por meio da junção com a tabela matéria
    db.query(
      "DELETE questao FROM questao INNER JOIN materia ON questao.materia_id = materia.id WHERE questao.id = ? AND materia.professor_id = ?",
      [identificadorDaQuestao, requisicao.session.user.id],
      (erro, resultado) => {
        if (erro) {
          console.error("Erro ao excluir a questão:", erro);
          return resposta
            .status(500)
            .json({ erro: "Erro ao excluir a questão." });
        }
        if (resultado.affectedRows === 0) {
          return resposta
            .status(403)
            .json({ erro: "Acesso negado ou questão inexistente." });
        }
        return resposta.json({ mensagem: "Questão excluída com sucesso!" });
      }
    );
  }
);

app.get("/editar-questao/:identificador", verificarAutenticacao, (req, res) => {
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
        return res.redirect("/questoes?page=1");
      }
      const questao = resultados[0];

      // Buscar cursos vinculados ao professor (ajuste se necessário via professor_curso)
      db.query(
        "SELECT c.id, c.nome FROM curso c INNER JOIN professor_curso pc ON c.id = pc.curso_id WHERE pc.professor_id = ?",
        [identificadorDoProfessor],
        (erro, cursos) => {
          if (erro) {
            console.error("Erro ao buscar cursos:", erro);
            cursos = [];
          }
          // Buscar matérias do professor (sem filtro por curso_id)
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
                mensagem: "", // Variável definida por extenso
              });
            }
          );
        }
      );
    }
  );
});

// Rota para salvar as alterações de uma questão editada
app.post("/editar-questao", verificarAutenticacao, (requisicao, resposta) => {
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
  } = requisicao.body;

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
    return resposta
      .status(400)
      .json({ erro: "Todos os campos são obrigatórios." });
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
      requisicao.session.user.id,
    ],
    (erro, resultado) => {
      if (erro) {
        console.error("Erro ao atualizar a questão:", erro);
        return resposta
          .status(500)
          .json({ erro: "Erro ao atualizar a questão." });
      }
      if (resultado.affectedRows === 0) {
        return resposta
          .status(403)
          .json({ erro: "Acesso negado ou questão inexistente." });
      }
      return resposta.json({ mensagem: "Questão editada com sucesso!" });
    }
  );
});

// ==========================
// Fim da rota de Questões
// ==========================

// ==========================
// Inicio da rota de Simulados
// ==========================
app.get("/simulados", verificarAutenticacao, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const offset = (page - 1) * limit;
  const searchTerm = req.query.search ? req.query.search.trim() : "";

  // Monta a cláusula WHERE para filtrar os simulados do professor logado
  let baseWhere = "WHERE s.professor_id = ?";
  let queryParams = [req.session.user.id];

  // Se houver termo de pesquisa, adiciona condições para título, nome do curso ou descrição
  if (searchTerm) {
    baseWhere +=
      " AND (s.titulo LIKE ? OR c.nome LIKE ? OR s.descricao LIKE ?)";
    const wildcard = "%" + searchTerm + "%";
    queryParams.push(wildcard, wildcard, wildcard);
  }

  // Query para contar o total de simulados
  const countQuery = `
    SELECT COUNT(*) AS count
    FROM simulado s
    INNER JOIN curso c ON s.curso_id = c.id
    ${baseWhere}
  `;
  db.query(countQuery, queryParams, (err, countResult) => {
    if (err) {
      console.error("Erro ao contar simulados:", err);
      return res.render("simulados", {
        message: "Erro ao buscar simulados",
        simulados: [],
        currentPage: page,
        totalPages: 0,
        totalRows: 0,
        cursos: [],
        search: searchTerm,
      });
    }
    const totalRows = countResult[0].count;
    const totalPages = Math.ceil(totalRows / limit);

    // Query para buscar os dados dos simulados com LIMIT e OFFSET
    const dataQuery = `
    SELECT s.id, s.titulo, s.descricao,
         DATE_FORMAT(s.data_simulacao, '%Y-%m-%d') AS data_simulacao,
         TIME_FORMAT(s.tempo_simulado, '%H:%i') AS tempo_simulado,
         c.nome AS curso,
         t.nome AS turma
    FROM simulado s
    INNER JOIN curso c ON s.curso_id = c.id
    LEFT JOIN simulado_turma st ON st.simulado_id = s.id AND st.agendada = 1
    LEFT JOIN turma t ON st.turma_id = t.id
    ${baseWhere}
    ORDER BY s.data_simulacao DESC
    LIMIT ? OFFSET ?
    `;

    let dataParams = queryParams.slice();
    dataParams.push(limit, offset);

    db.query(dataQuery, dataParams, (err, simulados) => {
      if (err) {
        console.error("Erro ao buscar simulados:", err);
        return res.render("simulados", {
          message: "Erro ao buscar simulados",
          simulados: [],
          currentPage: page,
          totalPages: 0,
          totalRows: 0,
          cursos: [],
          search: searchTerm,
        });
      }
      // Busca os cursos vinculados ao professor (para preencher selects no formulário, por exemplo)
      db.query(
        "SELECT c.id, c.nome FROM curso c INNER JOIN professor_curso pc ON c.id = pc.curso_id WHERE pc.professor_id = ?",
        [req.session.user.id],
        (err, cursos) => {
          if (err) {
            console.error("Erro ao buscar cursos:", err);
            cursos = [];
          }
          res.render("simulados", {
            message: "",
            simulados,
            currentPage: page,
            totalPages,
            totalRows,
            cursos,
            search: searchTerm,
          });
        }
      );
    });
  });
});

/**
 * Rota: GET /cadastrar-simulado
 * Renderiza o formulário para cadastrar um novo simulado.
 */
app.get("/cadastrar-simulado", async (req, res) => {
  try {
    // Busca os cursos para popular o select do formulário
    const [cursos] = await promisePool.query("SELECT * FROM curso");
    res.render("cadastrar-simulado", { cursos });
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro interno do servidor");
  }
});

/**
 * Rota: POST /cadastrar-simulado
 * Realiza o cadastro de um novo simulado.
 */
app.post("/cadastrar-simulado", async (req, res) => {
  try {
    // Exemplo: professor_id pode ser obtido da sessão (aqui está vindo via form)
    const {
      professor_id,
      curso_id,
      titulo,
      descricao,
      data_simulacao,
      tempo_simulado,
    } = req.body;
    await promisePool.query(
      `INSERT INTO simulado (professor_id, curso_id, titulo, descricao, data_simulacao, tempo_simulado)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        professor_id,
        curso_id,
        titulo,
        descricao,
        data_simulacao,
        tempo_simulado,
      ]
    );
    res.redirect("/simulados");
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro interno do servidor");
  }
});

/**
 * Rota: GET /editar-simulado/:id
 * Renderiza o formulário de edição para um simulado existente.
 */
app.get("/editar-simulado/:id", async (req, res) => {
  try {
    const { id } = req.params;
    // Busca o simulado pelo id
    const [simuladoResult] = await promisePool.query(
      "SELECT * FROM simulado WHERE id = ?",
      [id]
    );
    if (simuladoResult.length === 0) {
      return res.status(404).send("Simulado não encontrado");
    }
    const simulado = simuladoResult[0];
    // Busca os cursos para o select
    const [cursos] = await promisePool.query("SELECT * FROM curso");
    res.render("editar-simulado", { simulado, cursos });
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro interno do servidor");
  }
});

/**
 * Rota: POST /editar-simulado
 * Atualiza os dados de um simulado.
 */
app.post("/editar-simulado", async (req, res) => {
  try {
    const {
      id,
      professor_id,
      curso_id,
      titulo,
      descricao,
      data_simulacao,
      tempo_simulado,
    } = req.body;
    await promisePool.query(
      `UPDATE simulado 
       SET professor_id = ?, curso_id = ?, titulo = ?, descricao = ?, data_simulacao = ?, tempo_simulado = ?
       WHERE id = ?`,
      [
        professor_id,
        curso_id,
        titulo,
        descricao,
        data_simulacao,
        tempo_simulado,
        id,
      ]
    );
    res.redirect("/simulados");
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro interno do servidor");
  }
});

/**
 * Rota: DELETE /deletar-simulado/:id
 * Remove um simulado do banco de dados.
 */
app.delete("/deletar-simulado/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await promisePool.query("DELETE FROM simulado WHERE id = ?", [id]);
    res.status(200).send({ message: "Simulado excluído com sucesso" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro interno do servidor");
  }
});

// Inicializa o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
