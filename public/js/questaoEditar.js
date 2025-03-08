$(document).ready(function () {
  $("#form-editar-questao").submit(function (e) {
    e.preventDefault(); // Impede o envio padrão do formulário

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
        $.ajax({
          url: "/editar-questao",
          type: "POST",
          data: $("#form-editar-questao").serialize(),
          dataType: "json",
          success: function (response) {
            Swal.fire({
              title: "Editada!",
              text: response.mensagem, // Usando "mensagem" conforme o back‑end
              icon: "success",
              confirmButtonText: "OK",
              timer: 3000,
              timerProgressBar: true,
            }).then(() => {
              window.location.href = "/questao?page=1"; // Rota de listagem correta
            });
          },
          error: function (xhr) {
            let errorMsg =
              (xhr.responseJSON && xhr.responseJSON.error) ||
              "Erro ao editar questão.";
            Swal.fire("Erro!", errorMsg, "error");
          },
        });
      }
    });
  });
});
