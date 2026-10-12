FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY EccAi.Api/EccAi.Api.csproj EccAi.Api/
RUN dotnet restore EccAi.Api/EccAi.Api.csproj

COPY EccAi.Api/ EccAi.Api/
RUN dotnet publish EccAi.Api/EccAi.Api.csproj -c Release -o /app/publish --no-restore -p:SkipFrontend=true

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "EccAi.Api.dll"]
