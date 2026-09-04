# Use an official PHP image with Apache
FROM php:8.2-apache

# Enable Apache rewrite module if your site uses .htaccess routing
RUN a2enmod rewrite

# Install MySQL extensions for PHP
RUN docker-php-ext-install mysqli pdo pdo_mysql

# Copy your application files into Apache's web root
COPY . /var/www/html/

# Expose port 80 for Render
EXPOSE 80