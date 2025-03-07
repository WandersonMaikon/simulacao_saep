// Inicializa Choices para o select de cursos
const courseChoices = new Choices("#choices-multiple-remove-button", {
  removeItemButton: true,
  placeholder: true,
  placeholderValue: "Selecione o curso",
});
// Se o select de curso é o mesmo, certifique-se de usar o id correto; caso contrário, remova essa linha
new Choices("#choices-multiple-remove-button");

// Quando o curso for alterado, usa o valor selecionado para buscar matérias via AJAX
$("#choices-multiple-remove-button").on("change", function () {
  let selectedCourses = $(this).val();
  if (selectedCourses && selectedCourses.length > 0) {
    //curso selecionado para filtrar as matérias
    const cursoId = selectedCourses[0];
    $.ajax({
      url: "/materias-por-curso/" + cursoId,
      type: "GET",
      success: function (data) {
        const materiaSelect = $("#select-materia");
        materiaSelect.empty();
        if (data.length > 0) {
          data.forEach(function (materia) {
            materiaSelect.append(
              `<option value="${materia.id}">${materia.nome}</option>`
            );
          });
        } else {
          materiaSelect.append(
            `<option value="">Nenhuma matéria encontrada</option>`
          );
        }

        new Choices("#select-materia");
      },
      error: function () {
        console.error("Erro ao buscar matérias.");
      },
    });
  }
});

// Botão Cancelar: Se houver algum campo preenchido, avisa que os dados serão perdidos
$("#cancel-btn").click(function () {
  // Verifica se algum input ou textarea não está vazio
  let hasData = false;
  $("#form-cadastrar-questao")
    .find("input[type='text'], textarea")
    .each(function () {
      if ($(this).val().trim() !== "") {
        hasData = true;
        return false; // interrompe o loop
      }
    });
  if (hasData) {
    Swal.fire({
      title: "Tem certeza?",
      text: "Ao cancelar, todas as informações preenchidas serão perdidas.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sim, cancelar",
      cancelButtonText: "Voltar",
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
    }).then((result) => {
      if (result.isConfirmed) {
        // Limpa apenas os campos de texto e textarea, mantendo os selects
        $("#form-cadastrar-questao")
          .find("input[type='text'], textarea")
          .val("");
      }
    });
  } else {
    // Se não houver dados, apenas limpa os campos (ou faz outra ação)
    $("#form-cadastrar-questao")[0].reset();
  }
});

// Envio do formulário de cadastro de questão via AJAX
$("#form-cadastrar-questao").submit(function (e) {
  e.preventDefault();
  $.ajax({
    url: "/cadastrar-questao",
    type: "POST",
    data: $(this).serialize(),
    success: function (response) {
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
          // Limpa somente os inputs de texto e textarea para continuar no mesmo formulário,
          // mantendo os selects com os valores atuais.
          $("#form-cadastrar-questao")
            .find("input[type='text'], textarea")
            .val("");
        } else {
          window.location.href = "/questoes?page=1";
        }
      });
    },
    error: function (xhr) {
      let errorMsg =
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
