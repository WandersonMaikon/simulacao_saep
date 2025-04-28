// public/js/questaoCadastrar.js

// Inicializa Choices.js para o select de curso
const courseChoices = new Choices("#choices-multiple-remove-button", {
  removeItemButton: true,
  placeholderValue: "Selecione o curso",
});
window.courseChoices = courseChoices; // expõe globalmente para podermos limpar depois

let materiaChoices; // instância de Choices para matéria será criada após o carregamento por AJAX

// Quando o curso for alterado, busca matérias via AJAX e inicializa/atualiza Choices
$("#choices-multiple-remove-button").on("change", function () {
  const selected = $(this).val() || [];
  if (selected.length > 0) {
    const cursoId = selected[0];
    $.ajax({
      url: "/materias-por-curso/" + cursoId,
      type: "GET",
      success(data) {
        const materiaSelect = $("#select-materia");
        materiaSelect.empty();
        if (data.length > 0) {
          data.forEach((mat) => {
            materiaSelect.append(
              `<option value="${mat.id}">${mat.nome}</option>`
            );
          });
        } else {
          materiaSelect.append(
            `<option value="">Nenhuma matéria encontrada</option>`
          );
        }
        // Se já existir instância, destrói antes de recriar
        if (materiaChoices) {
          materiaChoices.destroy();
        }
        materiaChoices = new Choices("#select-materia", {
          removeItemButton: true,
          placeholderValue: "Selecione a matéria",
        });
        window.materiaChoices = materiaChoices;
      },
      error() {
        console.error("Erro ao buscar matérias.");
      },
    });
  }
});

// Botão Cancelar
$("#cancel-btn").click(function () {
  let hasData = false;
  $("#form-cadastrar-questao")
    .find("input[type='text'], textarea")
    .each(function () {
      if ($(this).val().trim() !== "") {
        hasData = true;
        return false;
      }
    });

  function doCancel() {
    $("#form-cadastrar-questao")[0].reset();
    quill.setContents([]);
    $("#hidden-enunciado").val("");
    courseChoices.removeActiveItems();
    if (materiaChoices) materiaChoices.removeActiveItems();
    $("#edit-section").addClass("hidden");
    window.location.href = "/admin/questao?page=1";
  }

  if (hasData) {
    Swal.fire({
      title: "Tem certeza?",
      text: "Ao cancelar, as informações preenchidas serão perdidas.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sim, cancelar",
      cancelButtonText: "Voltar",
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
    }).then((result) => {
      if (result.isConfirmed) {
        doCancel();
      }
    });
  } else {
    doCancel();
  }
});

// Captura o submit e envia por AJAX
$("#form-cadastrar-questao").submit(function (e) {
  e.preventDefault();

  // garante que o hidden tenha o HTML mais recente
  $("#hidden-enunciado").val(quill.root.innerHTML);

  $.ajax({
    url: "/cadastrar-questao",
    type: "POST",
    data: $(this).serialize(),
    success(response) {
      Swal.fire({
        title: "Questão adicionada!",
        text: "Deseja cadastrar outra questão?",
        icon: "success",
        showCancelButton: true,
        confirmButtonText: "Sim, continuar",
        cancelButtonText: "Não, ir para a listagem",
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
      }).then((result) => {
        if (result.isConfirmed) {
          // limpa o formulário completo
          const form = $("#form-cadastrar-questao");
          form[0].reset();

          // limpa Quill e hidden
          quill.setContents([]);
          $("#hidden-enunciado").val("");

          // limpa selects Choices.js
          courseChoices.removeActiveItems();
          if (materiaChoices) materiaChoices.removeActiveItems();
        } else {
          window.location.href = "/admin/questao?page=1";
        }
      });
    },
    error(xhr) {
      const errorMsg =
        (xhr.responseJSON && xhr.responseJSON.error) ||
        "Erro ao cadastrar questão.";
      Swal.fire({
        title: "Erro!",
        text: errorMsg,
        icon: "error",
        confirmButtonText: "OK",
        timer: 5000,
        timerProgressBar: true,
      });
    },
  });
});

// Realça link ativo no sidebar
document.addEventListener("DOMContentLoaded", function () {
  const questoesLink = document.querySelector('a[href="/admin/questao"]');
  if (questoesLink) {
    questoesLink.classList.add("active");
  }
});
