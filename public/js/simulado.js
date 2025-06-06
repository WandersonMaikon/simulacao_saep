$(document).ready(function () {
  // Variáveis globais
  var currentIndex = 0;
  var fieldsets = $("form fieldset");
  var totalSteps = fieldsets.length; // 5 etapas
  var allAlunos = [];
  var currentPageAlunos = 1;
  var itemsPerPage = 10;
  var selectedAlunosIds = [];
  var allQuestoes = [];
  var currentPageQuestoes = 1;
  var itemsPerPageQuestoes = 10;
  var selectedQuestoesIds = [];

  // Função para renderizar alunos
  function renderAlunosPage() {
    var tbody = $("#aluno-table-body");
    tbody.empty();
    var startIndex = (currentPageAlunos - 1) * itemsPerPage;
    var endIndex = startIndex + itemsPerPage;
    var alunosPage = allAlunos.slice(startIndex, endIndex);
    if (alunosPage.length > 0) {
      alunosPage.forEach(function (aluno) {
        var dataStr = aluno.data_cadastro || "";
        var dataObj = new Date(dataStr);
        if (isNaN(dataObj.getTime())) {
          dataObj = new Date(dataStr.replace(/-/g, "/"));
        }
        var dataFormatada = dataObj.getTime()
          ? dataObj.toLocaleString("pt-BR")
          : "";
        var checked =
          selectedAlunosIds.indexOf(aluno.id.toString()) !== -1
            ? "checked"
            : "";
        tbody.append(`
          <tr>
            <td class="px-6 py-3">
              <input type="checkbox" name="alunos[]" value="${
                aluno.id
              }" class="form-checkbox aluno-checkbox" ${checked}>
            </td>
            <td class="px-6 py-3">${aluno.id}</td>
            <td class="px-6 py-3">${aluno.nome}</td>
            <td class="px-6 py-3">${aluno.usuario || ""}</td>
          </tr>
        `);
      });
    } else {
      tbody.append(`
        <tr>
          <td colspan="7" class="text-center py-6">Nenhum aluno cadastrado nesta turma.</td>
        </tr>
      `);
    }
    renderPagination();
  }

  function renderPagination() {
    var totalPages = Math.ceil(allAlunos.length / itemsPerPage);
    var paginationHtml = "";
    for (var i = 1; i <= totalPages; i++) {
      if (i === currentPageAlunos) {
        paginationHtml += `<span class="px-3 py-1 bg-primary text-white rounded">${i}</span>`;
      } else {
        paginationHtml += `<a href="#" class="pagination-link px-3 py-1 bg-default-100 text-default-700 rounded" data-page="${i}">${i}</a>`;
      }
    }
    $("#aluno-pagination").html(paginationHtml);
  }

  $(document).on("click", ".pagination-link", function (e) {
    e.preventDefault();
    currentPageAlunos = parseInt($(this).data("page"));
    renderAlunosPage();
  });

  $("#select-all-alunos").on("change", function () {
    var checked = $(this).prop("checked");
    selectedAlunosIds = checked
      ? allAlunos.map(function (aluno) {
          return aluno.id.toString();
        })
      : [];
    $("#aluno-table-body .aluno-checkbox").prop("checked", checked);
  });

  $(document).on("change", ".aluno-checkbox", function () {
    var alunoId = $(this).val();
    if ($(this).prop("checked")) {
      if (selectedAlunosIds.indexOf(alunoId) === -1) {
        selectedAlunosIds.push(alunoId);
      }
    } else {
      selectedAlunosIds = selectedAlunosIds.filter(function (id) {
        return id !== alunoId;
      });
      $("#select-all-alunos").prop("checked", false);
    }
  });

  // Busca alunos via AJAX ao alterar a turma
  $("#select-turma").on("change", function () {
    var turmaId = $(this).val();
    console.log("Turma selecionada:", turmaId);
    if (!turmaId) {
      $("#aluno-table-body").html(`
        <tr>
          <td colspan="4" class="text-center py-6">Nenhum aluno cadastrado nesta turma.</td>
        </tr>
      `);
      $("#aluno-pagination").empty();
      return;
    }
    $.ajax({
      url: "/alunos-por-turma/" + turmaId,
      type: "GET",
      dataType: "json",
      success: function (data) {
        console.log("Resposta de alunos:", data);
        allAlunos = data;
        currentPageAlunos = 1;
        renderAlunosPage();
        if ($("#select-all-alunos").prop("checked")) {
          selectedAlunosIds = allAlunos.map(function (aluno) {
            return aluno.id.toString();
          });
        }
      },
      error: function () {
        Swal.fire({
          icon: "error",
          title: "Erro",
          text: "Erro ao buscar alunos.",
        });
      },
    });
  });

  // Função para renderizar questões
  function renderQuestoesPage() {
    var tbody = $("#questao-table-body");
    tbody.empty();
    var startIndex = (currentPageQuestoes - 1) * itemsPerPageQuestoes;
    var endIndex = startIndex + itemsPerPageQuestoes;
    var questoesPage = allQuestoes.slice(startIndex, endIndex);
    if (questoesPage.length > 0) {
      questoesPage.forEach(function (questao) {
        var checked =
          selectedQuestoesIds.indexOf(questao.id.toString()) !== -1
            ? "checked"
            : "";
        tbody.append(`
          <tr>
            <td class="px-6 py-3">
              <input type="checkbox" name="questoes[]" value="${questao.id}" class="form-checkbox questao-checkbox" ${checked}>
            </td>
            <td class="px-6 py-3">${questao.id}</td>
            <td class="px-6 py-3">${questao.titulo}</td>
            <td class="px-6 py-3">${questao.curso}</td>
            <td class="px-6 py-3">${questao.materia}</td>
            <td class="px-6 py-3">${questao.enunciado}</td>
          </tr>
        `);
      });
    } else {
      tbody.append(`
        <tr>
          <td colspan="6" class="text-center py-6">Nenhuma questão encontrada.</td>
        </tr>
      `);
    }
    renderQuestoesPagination();
  }

  function renderQuestoesPagination() {
    var totalPages = Math.ceil(allQuestoes.length / itemsPerPageQuestoes);
    var paginationHtml = "";
    for (var i = 1; i <= totalPages; i++) {
      if (i === currentPageQuestoes) {
        paginationHtml += `<span class="px-3 py-1 bg-primary text-white rounded">${i}</span>`;
      } else {
        paginationHtml += `<a href="#" class="pagination-link-questao px-3 py-1 bg-default-100 text-default-700 rounded" data-page="${i}">${i}</a>`;
      }
    }
    $("#questao-pagination").html(paginationHtml);
  }

  $(document).on("click", ".pagination-link-questao", function (e) {
    e.preventDefault();
    currentPageQuestoes = parseInt($(this).data("page"));
    renderQuestoesPage();
  });

  $("#select-all-questoes").on("change", function () {
    var checked = $(this).prop("checked");
    selectedQuestoesIds = checked
      ? allQuestoes.map(function (questao) {
          return questao.id.toString();
        })
      : [];
    $("#questao-table-body .questao-checkbox").prop("checked", checked);
  });

  $(document).on("change", ".questao-checkbox", function () {
    var questaoId = $(this).val();
    if ($(this).prop("checked")) {
      if (selectedQuestoesIds.indexOf(questaoId) === -1) {
        selectedQuestoesIds.push(questaoId);
      }
    } else {
      selectedQuestoesIds = selectedQuestoesIds.filter(function (id) {
        return id !== questaoId;
      });
      $("#select-all-questoes").prop("checked", false);
    }
  });

  // Busca questões via AJAX – chamada ao entrar na Etapa 4
  function fetchQuestoes() {
    var cursoId = $("#select-curso").val();
    if (!cursoId) {
      console.error("Curso não selecionado.");
      return;
    }
    $.ajax({
      url: "/questao-por-curso/" + cursoId,
      type: "GET",
      dataType: "json",
      success: function (data) {
        console.log("Resposta de questões:", data);
        allQuestoes = data;
        currentPageQuestoes = 1;
        renderQuestoesPage();
      },
      error: function () {
        Swal.fire({
          icon: "error",
          title: "Erro",
          text: "Erro ao buscar questões.",
        });
      },
    });
  }

  $("#questao-search").on("keyup", function () {
    var query = $(this).val().toLowerCase();
    $("#questao-table-body tr").each(function () {
      var idText = $(this).find("td:nth-child(2)").text().toLowerCase();
      var tituloText = $(this).find("td:nth-child(3)").text().toLowerCase();
      var cursoText = $(this).find("td:nth-child(4)").text().toLowerCase();
      var materiaText = $(this).find("td:nth-child(5)").text().toLowerCase();
      var enunciadoText = $(this).find("td:nth-child(6)").text().toLowerCase();
      if (
        idText.indexOf(query) > -1 ||
        tituloText.indexOf(query) > -1 ||
        cursoText.indexOf(query) > -1 ||
        materiaText.indexOf(query) > -1 ||
        enunciadoText.indexOf(query) > -1
      ) {
        $(this).show();
      } else {
        $(this).hide();
      }
    });
  });

  // Atualiza o resumo final na Etapa 5
  function updateReviewFinal() {
    var cursoText = $("#select-curso option:selected").text();
    var turmaText = $("#select-turma option:selected").text();
    var selectedAlunos = allAlunos.filter(function (aluno) {
      return selectedAlunosIds.indexOf(aluno.id.toString()) !== -1;
    });
    var alunosText = selectedAlunos
      .map(function (aluno) {
        return aluno.nome;
      })
      .join(", ");
    var selectedQuestoes = allQuestoes.filter(function (questao) {
      return selectedQuestoesIds.indexOf(questao.id.toString()) !== -1;
    });
    var questoesText = selectedQuestoes
      .map(function (questao) {
        return questao.titulo;
      })
      .join(", ");

    $("#resumo-final-curso").text(cursoText);
    $("#resumo-final-turma").text(turmaText);
    $("#resumo-final-alunos").text(alunosText || "Nenhum aluno selecionado");
    $("#resumo-final-questoes").text(
      questoesText || "Nenhuma questão selecionada"
    );
  }

  // Exibe a etapa atual e atualiza a barra de progresso
  function showStep(index) {
    fieldsets.removeClass("active");
    fieldsets.eq(index).addClass("active");
    var percent = ((index + 1) / totalSteps) * 100;
    $("#progress-step")
      .css("width", percent + "%")
      .attr("aria-valuenow", percent)
      .text(Math.round(percent) + "%");

    // Se estiver na Etapa 4 (índice 3), carrega as questões se ainda não estiverem
    if (index === 3 && allQuestoes.length === 0) {
      fetchQuestoes();
    }
    // Se estiver na Etapa 5 (revisão final), atualiza o resumo
    if (index === totalSteps - 1) {
      updateReviewFinal();
    }
  }

  $(".next").click(function () {
    var valid = true;
    var currentFieldset = fieldsets.eq(currentIndex);
    currentFieldset.find("select[required]").each(function () {
      if (
        !$(this).val() ||
        ($(this).attr("multiple") && $(this).val().length === 0)
      ) {
        valid = false;
        Swal.fire({
          icon: "warning",
          title: "Atenção",
          text: "Preencha os campos obrigatórios!",
        });
        return false;
      }
    });
    if (!valid) return false;

    if (currentIndex === 0) {
      var cursoId = $("#select-curso").val();
      if (!cursoId) {
        Swal.fire({
          icon: "warning",
          title: "Atenção",
          text: "Selecione um curso!",
        });
        return;
      }
      $.ajax({
        url: "/turmas-por-curso/" + cursoId,
        type: "GET",
        dataType: "json",
        success: function (data) {
          var $turmaSelect = $("#select-turma");
          $turmaSelect.empty();
          if (data.length > 0) {
            $turmaSelect.append(
              '<option value="">Selecione uma turma</option>'
            );
            data.forEach(function (turma) {
              $turmaSelect.append(
                `<option value="${turma.id}">${turma.nome}</option>`
              );
            });
          } else {
            $turmaSelect.append(
              '<option value="">Nenhuma turma disponível</option>'
            );
          }
          var instance = $turmaSelect.data("choices");
          if (instance) {
            instance.destroy();
            $turmaSelect.removeData("choices");
          }
          new Choices($turmaSelect[0], { removeItemButton: false });
          currentIndex++;
          showStep(currentIndex);
        },
        error: function () {
          Swal.fire({
            icon: "error",
            title: "Erro",
            text: "Erro ao buscar turmas.",
          });
        },
      });
    } else {
      currentIndex++;
      if (currentIndex >= totalSteps) currentIndex = totalSteps - 1;
      showStep(currentIndex);
    }
  });

  $(".prev").click(function () {
    currentIndex--;
    if (currentIndex < 0) currentIndex = 0;
    showStep(currentIndex);
  });

  // Inicializa a primeira etapa e Choices.js para o select de curso
  showStep(currentIndex);
  new Choices("#select-curso", { removeItemButton: false });

  // Intercepta o submit do formulário para solicitar campos adicionais via modal
  $("#form-cadastrar-simulado").submit(function (e) {
    e.preventDefault(); // Impede o envio normal do formulário
    Swal.fire({
      title: "Informe os dados adicionais",
      html:
        "<div>" +
        '<label for="simpleinput" class="text-default-800 text-sm font-medium inline-block mb-2">Text</label>' +
        '<input type="text" id="simpleinput" class="block w-full rounded py-2.5 px-4 text-default-800 text-sm focus:ring-transparent border-default-200 dark:bg-default-50" placeholder="Descrição">' +
        "</div>" +
        '<div style="margin-top:1rem;">' +
        '<label for="example-time" class="text-default-800 text-sm font-medium inline-block mb-2">Time</label>' +
        '<input id="example-time" type="time" class="block w-full rounded py-2.5 px-4 text-default-800 text-sm focus:ring-transparent border-default-200 dark:bg-default-50" placeholder="Tempo de prova (HH:MM:SS)">' +
        "</div>",
      focusConfirm: false,
      preConfirm: () => {
        const descricao = $("#simpleinput").val().trim();
        const tempo = $("#example-time").val().trim();
        if (!descricao || !tempo) {
          Swal.showValidationMessage("Preencha ambos os campos");
        }
        // Se o input de tempo não contiver um traço, assume que é apenas o horário e concatena com a data atual
        let tempoFormatted = tempo;
        if (tempo.indexOf("-") === -1) {
          let today = new Date();
          let yyyy = today.getFullYear();
          let mm = String(today.getMonth() + 1).padStart(2, "0");
          let dd = String(today.getDate()).padStart(2, "0");
          tempoFormatted = `${yyyy}-${mm}-${dd} ${tempo}`;
        }
        return { descricao: descricao, tempo: tempoFormatted };
      },
      showCancelButton: true,
      confirmButtonText: "Confirmar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#10b981",
      cancelButtonColor: "#d33",
    }).then((result) => {
      if (result.isConfirmed) {
        // Remove inputs hidden anteriores (se houver)
        $("#form-cadastrar-simulado input[name='tempo_prova']").remove();
        $("#form-cadastrar-simulado input[name='descricao']").remove();
        // Adiciona os novos campos ao formulário
        $("<input>")
          .attr({
            type: "hidden",
            name: "tempo_prova",
            value: result.value.tempo,
          })
          .appendTo("#form-cadastrar-simulado");
        $("<input>")
          .attr({
            type: "hidden",
            name: "descricao",
            value: result.value.descricao,
          })
          .appendTo("#form-cadastrar-simulado");

        // Envia o formulário via AJAX
        var formData = $(this).serialize();
        $.ajax({
          url: $(this).attr("action"),
          method: $(this).attr("method"),
          data: formData,
          dataType: "json",
          success: function (response) {
            if (response.success) {
              Swal.fire({
                icon: "success",
                title: "Simulado cadastrado com sucesso!",
                text: response.message,
                timer: 2000,
                showConfirmButton: false,
              }).then(function () {
                window.location.href = "/simulados";
              });
            } else {
              Swal.fire({
                icon: "error",
                title: "Erro",
                text: response.error,
              });
            }
          },
          error: function () {
            Swal.fire({
              icon: "error",
              title: "Erro",
              text: "Ocorreu um erro ao cadastrar o simulado.",
            });
          },
        });
      }
    });
  });
});

// Ativação do simulado via checkbox
$(document).on("change", ".ativar-simulado", function () {
  var checkbox = $(this);
  // Se o checkbox for marcado (tentativa de ativação)
  if (checkbox.is(":checked")) {
    Swal.fire({
      title: "Atenção",
      text: "Esta operação não poderá ser desfeita! Deseja prosseguir para ativar este simulado?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sim, ativar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#10b981",
      cancelButtonColor: "#d33",
    }).then((result) => {
      if (result.isConfirmed) {
        var simuladoId = checkbox.data("id");
        // Envia requisição AJAX para ativar o simulado
        $.ajax({
          url: "/ativar-simulado/" + simuladoId,
          method: "PUT",
          dataType: "json",
          success: function (response) {
            if (response.success) {
              Swal.fire({
                icon: "success",
                title: "Simulado ativado!",
                text: response.message,
                timer: 2000,
                showConfirmButton: false,
              });
              // Desabilita o checkbox para não permitir alteração
              checkbox.prop("disabled", true);
            } else {
              Swal.fire({
                icon: "error",
                title: "Erro",
                text: response.error,
              });
              checkbox.prop("checked", false);
            }
          },
          error: function () {
            Swal.fire({
              icon: "error",
              title: "Erro",
              text: "Não foi possível ativar o simulado.",
            });
            checkbox.prop("checked", false);
          },
        });
      } else {
        // Se cancelar, reverte o checkbox
        checkbox.prop("checked", false);
      }
    });
  }
});

$(document).on("change", ".finalizado-simulado", function () {
  var checkbox = $(this);
  // Se o checkbox for marcado (tentativa de finalização)
  if (checkbox.is(":checked")) {
    Swal.fire({
      title: "Atenção",
      text: "Esta operação não poderá ser desfeita! Deseja prosseguir para finalizar este simulado?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sim, finalizar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#10b981",
      cancelButtonColor: "#d33",
    }).then((result) => {
      if (result.isConfirmed) {
        var simuladoId = checkbox.data("id");
        // Envia requisição AJAX para finalizar o simulado
        $.ajax({
          url: "/finalizar-simulado/" + simuladoId,
          method: "PUT",
          dataType: "json",
          success: function (response) {
            if (response.success) {
              Swal.fire({
                icon: "success",
                title: "Simulado finalizado!",
                text: response.message,
                timer: 2000,
                showConfirmButton: false,
              });
              // Desabilita o checkbox para não permitir alteração
              checkbox.prop("disabled", true);
            } else {
              Swal.fire({
                icon: "error",
                title: "Erro",
                text: response.error,
              });
              // Reverte a seleção do checkbox
              checkbox.prop("checked", false);
            }
          },
          error: function () {
            Swal.fire({
              icon: "error",
              title: "Erro",
              text: "Não foi possível finalizar o simulado.",
            });
            // Reverte a seleção do checkbox
            checkbox.prop("checked", false);
          },
        });
      } else {
        // Se cancelar, reverte o checkbox
        checkbox.prop("checked", false);
      }
    });
  }
});

$("#aluno-search").on("keyup", function () {
  var query = $(this).val().toLowerCase();
  $("#aluno-table-body tr").each(function () {
    var idText = $(this).find("td:nth-child(2)").text().toLowerCase();
    var nomeText = $(this).find("td:nth-child(3)").text().toLowerCase();
    var usuarioText = $(this).find("td:nth-child(4)").text().toLowerCase();
    if (
      idText.indexOf(query) > -1 ||
      nomeText.indexOf(query) > -1 ||
      usuarioText.indexOf(query) > -1
    ) {
      $(this).show();
    } else {
      $(this).hide();
    }
  });
});
// Conecta ao Socket.IO
const socket = io();

// Escuta o evento de atualização de simulado
socket.on("updateSimulation", function (data) {
  // Atualiza o checkbox de "Simulação ativa?" com base no ID
  const checkbox = document.querySelector(
    `input.ativar-simulado[data-id="${data.id}"]`
  );
  if (checkbox) {
    if (data.ativa == 1) {
      checkbox.checked = true;
      checkbox.disabled = true;
    } else {
      checkbox.checked = false;
      checkbox.disabled = false;
    }
  }
});
$(function () {
  // 1) detecta simulado ativo
  const $activeInput = $("input.ativar-simulado:checked").first();
  if (!$activeInput.length) return;

  const id = $activeInput.data("id");

  // 2) monta o card com número + texto pequeno
  const $card = $(`
    <a href="/admin/monitor-simulado/${id}"
       class="shadow rounded-lg bg-white dark:bg-default-50 hover:shadow-lg transition-shadow block">
      <div class="p-5">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-base font-semibold text-default-600">Simulado Ativo</p>
            <div class="mt-4 flex items-baseline gap-2">
              <span class="active-count text-2xl font-semibold text-default-900">0</span>
              <span class="text-xs text-default-600">Alunos online</span>
            </div>
          </div>
          <span class="blinking-dot"></span>
        </div>
      </div>
    </a>
  `);

  $(".p-6.space-y-6 > .grid").append($card);

  // 3) função para buscar o count exato
  function fetchCount() {
    $.getJSON(`/admin/simulados/${id}/active-count`).done((res) => {
      if (typeof res.count === "number") {
        $card.find(".active-count").text(res.count);
      }
    });
  }

  // 4) dispara imediatamente e a cada 5s
  fetchCount();
  setInterval(fetchCount, 5000);
});
