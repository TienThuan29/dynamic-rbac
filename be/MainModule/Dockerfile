FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY ["MainModule.csproj", "./"]
RUN dotnet restore "MainModule.csproj"
COPY . .
WORKDIR "/src/."
RUN dotnet build "MainModule.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "MainModule.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "MainModule.dll"]
