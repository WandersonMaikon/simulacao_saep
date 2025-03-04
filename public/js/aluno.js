$(document).ready(function () {
  // Obtém o caminho atual (sem query string)
  var currentPath = window.location.pathname;

  // Percorre os links do sidebar
  $(".admin-menu a").each(function () {
    var linkPath = $(this).attr("href");

    // Se o caminho atual for igual ou iniciar com o caminho do link, adiciona a classe active
    if (currentPath === linkPath || currentPath.indexOf(linkPath) === 0) {
      $(this).addClass("active");
    }
  });
});
