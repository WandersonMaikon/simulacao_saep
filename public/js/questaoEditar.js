$(document).ready(function () {
  // Intercepta o submit do formulário de edição de questão
  $("#form-editar-questao").submit(function (e) {
    e.preventDefault(); // Impede o envio padrão do formulário

    // Exibe uma mensagem de confirmação com SweetAlert2
    Swal.fire({
      title: "Tem certeza?",
      text: "Deseja salvar as alterações nesta questão?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sim, editar!",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
    }).then((result) => {
      if (result.isConfirmed) {
        // Envia os dados do formulário via AJAX
        $.ajax({
          url: "/editar-questao",
          type: "POST",
          data: $("#form-editar-questao").serialize(),
          dataType: "json",
          success: function (response) {
            Swal.fire({
              title: "Editada!",
              text: response.message, // Exibe a mensagem retornada pelo back‑end
              icon: "success",
              confirmButtonText: "OK",
              timer: 3000,
              timerProgressBar: true,
            }).then(() => {
              // Redireciona para a listagem de questões (ou recarrega a página)
              window.location.href = "/questao";
            });
          },
          error: function (xhr) {
            let errorMsg =
              (xhr.responseJSON && xhr.responseJSON.error) ||
              "Erro ao editar questão.";
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
      }
    });
  });
});
