from django.http import HttpRequest, HttpResponse
from django.shortcuts import render


def home(request: HttpRequest) -> HttpResponse:
    """Placeholder home page. Features land here as the backlog moves."""
    return render(request, "home.html")
